import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
export const minor = z.number().int().min(0).max(2_000_000_000);
export const quantity = z.number().int().positive().max(100000);
export const text = z.string().trim().min(1).max(200);
export const orderInput = z.object({
  clientOrderId: z.uuid(),
  outletId: text,
  distributorId: text,
  priceListVersion: z.number().int().positive(),
  orderedAt: z.iso.datetime(),
  notes: z.string().max(500).default(""),
  lines: z
    .array(z.object({ skuId: text, qty: quantity }))
    .min(1)
    .max(100),
});
export const collectionInput = z
  .object({
    clientCollectionId: z.uuid(),
    outletId: text,
    amountMinor: minor.refine((n) => n > 0),
    method: z.enum(["CASH", "BKASH", "NAGAD", "CHEQUE"]),
    reference: z.string().max(100).default(""),
  })
  .refine((v) => v.method === "CASH" || v.reference.length > 0, {
    message: "Payment reference is required",
  });
