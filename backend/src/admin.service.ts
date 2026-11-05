import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hash } from "bcryptjs";
import { z } from "zod";
import { Db } from "./db";
import { Actor, permit } from "./auth";
import { minor, parse, text } from "./validation";
@Injectable()
export class AdminService {
  constructor(@Inject(Db) private db: Db) {}
  async create(u: Actor, kind: string, body: unknown) {
    permit(u, ["COMPANY_ADMIN"]);
    if (kind === "users") {
      const d = parse(
        z.object({
          email: z.email().max(200),
          fullName: text,
          password: z.string().min(12).max(128),
          role: z.enum([
            "COMPANY_ADMIN",
            "AREA_MANAGER",
            "DISTRIBUTOR",
            "SR",
            "ACCOUNTS",
          ]),
          territoryId: text,
          distributorId: z.string().optional(),
        }),
        body,
      );
      if (
        d.role === "DISTRIBUTOR" &&
        !(await this.db.distributor.findFirst({
          where: {
            id: d.distributorId || "__none",
            territoryId: d.territoryId,
          },
        }))
      )
        throw new BadRequestException(
          "Choose a distributor in the assigned territory",
        );
      const { password, ...rest } = d;
      const result = await this.db.user.create({
        data: {
          ...rest,
          email: rest.email.toLowerCase(),
          distributorId:
            rest.role === "DISTRIBUTOR" ? rest.distributorId : null,
          passwordHash: await hash(password, 12),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          territoryId: true,
        },
      });
      await this.db.auditLog.create({
        data: {
          actorId: u.id,
          action: "USER_CREATED",
          entityId: result.id,
          details: { role: result.role },
        },
      });
      return result;
    }
    if (kind === "territories") {
      const d = parse(z.object({ region: text, area: text, name: text }), body);
      return this.db.serial(async (tx) => {
        const region = await tx.region.upsert({
          where: { name: d.region },
          create: { name: d.region },
          update: {},
        });
        const area =
          (await tx.area.findFirst({
            where: { name: d.area, regionId: region.id },
          })) ||
          (await tx.area.create({
            data: { name: d.area, regionId: region.id },
          }));
        return tx.territory.create({ data: { name: d.name, areaId: area.id } });
      });
    }
    if (kind === "prices") {
      const d = parse(z.object({ skuId: text, priceMinor: minor }), body);
      return this.db.serial(async (tx) => {
        if (!(await tx.sku.findUnique({ where: { id: d.skuId } })))
          throw new NotFoundException();
        const old = await tx.priceList.findFirstOrThrow({
          where: { active: true },
          orderBy: { version: "desc" },
          include: { items: true },
        });
        await tx.priceList.update({
          where: { id: old.id },
          data: { active: false },
        });
        return tx.priceList.create({
          data: {
            name: old.name,
            version: old.version + 1,
            items: {
              create: old.items.map((i) => ({
                skuId: i.skuId,
                priceMinor: i.skuId === d.skuId ? d.priceMinor : i.priceMinor,
              })),
            },
          },
        });
      });
    }
    throw new BadRequestException("Unsupported admin resource");
  }
}
