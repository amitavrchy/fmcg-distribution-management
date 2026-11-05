import { Inject } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { verify } from "jsonwebtoken";
import { Db } from "./db";
import { Actor, secret } from "./auth";
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || "http://127.0.0.1:3000").split(","),
    credentials: true,
  },
})
export class Realtime implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(@Inject(Db) private db: Db) {}
  async handleConnection(socket: Socket) {
    try {
      const cookies = Object.fromEntries(
        (socket.handshake.headers.cookie || "")
          .split(";")
          .map((c) => c.trim().split("=")),
      );
      const payload = verify(cookies.session, secret(), {
        issuer: "fmcg",
        audience: "fmcg-web",
      }) as { sub: string; v?: number };
      const user = await this.db.user.findUniqueOrThrow({
        where: { id: payload.sub },
      });
      if (!user.active || user.sessionVersion !== (payload.v || 0))
        throw new Error("Session revoked");
      socket.join(`user:${user.id}`);
      if (user.role === "COMPANY_ADMIN") socket.join("admins");
      if (user.territoryId && user.role === "AREA_MANAGER")
        socket.join(`territory:${user.territoryId}`);
    } catch {
      socket.disconnect(true);
    }
  }
  changed(user: Actor) {
    this.server
      ?.to("admins")
      .to(`territory:${user.territoryId}`)
      .to(`user:${user.id}`)
      .emit("refresh", { at: new Date().toISOString() });
  }
}
