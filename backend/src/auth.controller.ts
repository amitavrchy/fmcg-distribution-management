import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { compare } from "bcryptjs";
import type { Request, Response } from "express";
import { Db } from "./db";
import { AuthGuard, token, Actor } from "./auth";
import { parse } from "./validation";
import { z } from "zod";
const failures = new Map<string, { count: number; until: number }>();
@Controller("api/auth")
export class AuthController {
  constructor(@Inject(Db) private db: Db) {}
  @Post("login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z.object({
        email: z.email().max(200),
        password: z.string().min(1).max(200),
      }),
      body,
    );
    const key = `${req.ip}:${data.email.toLowerCase()}`,
      entry = failures.get(key);
    if (entry && entry.until > Date.now() && entry.count >= 8)
      throw new UnauthorizedException(
        "Too many attempts. Try again in 15 minutes.",
      );
    const user = await this.db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (!user || !(await compare(data.password, user.passwordHash))) {
      if (failures.size > 10000) failures.clear();
      failures.set(key, {
        count: entry && entry.until > Date.now() ? entry.count + 1 : 1,
        until: Date.now() + 900000,
      });
      throw new UnauthorizedException("Email or password is incorrect");
    }
    failures.delete(key);
    res.cookie("session", token(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 43200000,
      path: "/",
    });
    const { passwordHash, ...safe } = user;
    return safe;
  }
  @Get("me") @UseGuards(AuthGuard) me(@Req() req: Request & { user: Actor }) {
    return req.user;
  }
  @Post("logout") logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("session", { path: "/" });
    return { ok: true };
  }
}
