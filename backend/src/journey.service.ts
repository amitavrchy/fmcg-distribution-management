import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { Db } from "./db";
import { Actor, sellers, permit, outletScope } from "./auth";
import { dhakaDate, distanceMeters } from "./domain/geo";
import { parse, text } from "./validation";
@Injectable()
export class JourneyService {
  constructor(@Inject(Db) private db: Db) {}
  async visit(u: Actor, body: unknown) {
    permit(u, sellers);
    const d = parse(
      z.object({
        outletId: text,
        callType: z.enum(["ORDER", "NO_ORDER", "CLOSED", "PRODUCTIVE"]),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        notes: z.string().max(500).default(""),
      }),
      body,
    );
    const outlet = await this.db.outlet.findFirst({
      where: { id: d.outletId, ...outletScope(u) },
    });
    if (!outlet) throw new NotFoundException();
    const anomaly =
      outlet.lat !== null &&
      outlet.lng !== null &&
      distanceMeters(d.lat, d.lng, outlet.lat, outlet.lng) >
        Number(process.env.GEO_FENCE_METERS || 500);
    const { outletId, ...data } = d,
      beatDate = dhakaDate();
    return this.db.journeyVisit.upsert({
      where: { srId_outletId_beatDate: { srId: u.id, outletId, beatDate } },
      create: {
        ...data,
        outletId,
        srId: u.id,
        beatDate,
        checkInAt: new Date(),
        anomaly,
      },
      update: { ...data, checkInAt: new Date(), anomaly },
    });
  }
}
