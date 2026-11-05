import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db";
import { Actor, managers, outletScope, permit } from "../auth";
import { parse, text } from "../validation";
import { parseCsv } from "../domain/csv";
import { audit } from "./common";
@Injectable()
export class ImportService {
  constructor(@Inject(Db) private db: Db) {}
  async preview(u: Actor, body: unknown) {
    permit(u, managers);
    const { csv } = parse(
      z.object({ csv: z.string().min(1).max(250000) }),
      body,
    );
    let matrix: string[][];
    try {
      matrix = parseCsv(csv);
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "Invalid CSV",
      );
    }
    const headers = matrix[0].map((h) => h.toLowerCase()),
      required = [
        "code",
        "name",
        "owner",
        "phone",
        "address",
        "beat",
        "creditbdt",
      ];
    if (
      required.some((h) => !headers.includes(h)) ||
      new Set(headers).size !== headers.length
    )
      throw new BadRequestException(
        `Required unique headers: ${required.join(", ")}`,
      );
    const beats = await this.db.beat.findMany({
        where:
          u.role === "COMPANY_ADMIN"
            ? {}
            : { territoryId: u.territoryId || "__none" },
      }),
      existing = await this.db.outlet.findMany({
        where: outletScope(u),
        select: { beatId: true, code: true },
      }),
      seen = new Set<string>();
    const rows = matrix.slice(1).map((values, i) => {
      const raw = Object.fromEntries(
          headers.map((h, j) => [h, values[j] || ""]),
        ),
        beat = beats.filter(
          (b) =>
            b.id === raw.beat ||
            b.name.toLowerCase() === raw.beat.toLowerCase(),
        );
      const validation = z
        .object({
          code: text,
          name: text,
          owner: text,
          phone: z.string().regex(/^01\d{9}$/),
          address: text,
          creditbdt: z.coerce.number().min(0).max(20000000),
        })
        .safeParse(raw);
      const errors: string[] = [];
      if (!validation.success)
        errors.push(
          ...validation.error.issues.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          ),
        );
      if (beat.length !== 1)
        errors.push("Beat must match exactly one accessible name or ID");
      if (values.length !== headers.length)
        errors.push("Column count differs from headers");
      const key = `${beat[0]?.id}:${raw.code}`;
      if (seen.has(key)) errors.push("Duplicate beat/code in file");
      seen.add(key);
      const skip = existing.some(
        (o) => o.beatId === beat[0]?.id && o.code === raw.code,
      );
      return {
        row: i + 2,
        code: raw.code,
        name: raw.name,
        beat: raw.beat,
        status: errors.length ? "ERROR" : skip ? "SKIP" : "READY",
        errors,
        data:
          !errors.length && validation.success
            ? {
                code: validation.data.code,
                name: validation.data.name,
                owner: validation.data.owner,
                phone: validation.data.phone,
                address: validation.data.address,
                beatId: beat[0].id,
                creditLimitMinor: Math.round(validation.data.creditbdt * 100),
                channel: "GENERAL",
              }
            : null,
      };
    });
    return {
      rows,
      total: rows.length,
      ready: rows.filter((r) => r.status === "READY").length,
      skipped: rows.filter((r) => r.status === "SKIP").length,
      errors: rows.filter((r) => r.status === "ERROR").length,
    };
  }
  async apply(u: Actor, body: unknown) {
    const preview = await this.preview(u, body);
    if (preview.errors)
      throw new BadRequestException(
        "Resolve every validation error before importing",
      );
    return this.db.serial(async (tx) => {
      const result = await tx.outlet.createMany({
        data: preview.rows
          .filter((r) => r.status === "READY")
          .map((r) => r.data!),
        skipDuplicates: true,
      });
      await audit(tx, u, "OUTLETS_IMPORTED", u.id, {
        imported: result.count,
        skipped: preview.skipped,
      });
      return { imported: result.count, skipped: preview.total - result.count };
    });
  }
}
