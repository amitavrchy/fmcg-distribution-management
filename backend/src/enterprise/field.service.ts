import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Db } from "../db";
import {
  Actor,
  managers,
  operators,
  sellers,
  outletScope,
  permit,
  distributorScope,
  userScope,
} from "../auth";
import { parse, minor, text } from "../validation";
import { optimizeStops } from "../domain/enterprise";
import { audit, checkDistributor } from "./common";
import { OrdersService } from "../orders.service";
@Injectable()
export class FieldService {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(OrdersService) private orders: OrdersService,
  ) {}
  async vehicle(u: Actor, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        registration: text,
        name: text,
        distributorId: text,
        capacityKg: z.number().int().min(1).max(100000),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      await checkDistributor(tx, u, d.distributorId);
      return tx.vehicle.create({ data: d });
    });
  }
  async trip(u: Actor, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        warehouseId: text,
        vehicleId: text,
        driverId: text,
        scheduledOn: z.iso.datetime(),
        orderIds: z.array(text).min(1).max(80),
      }),
      body,
    );
    if (new Set(d.orderIds).size !== d.orderIds.length)
      throw new BadRequestException("An order cannot appear twice in a trip");
    return this.db.serial(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: d.warehouseId,
          active: true,
          distributor: distributorScope(u),
        },
      });
      if (!warehouse) throw new NotFoundException();
      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: d.vehicleId,
          active: true,
          distributorId: warehouse.distributorId,
        },
      });
      if (!vehicle)
        throw new BadRequestException(
          "Vehicle belongs to another distribution partner",
        );
      const driver = await tx.user.findFirst({
        where: {
          id: d.driverId,
          role: { in: ["SR", "DISTRIBUTOR"] },
          territoryId: (
            await tx.distributor.findUniqueOrThrow({
              where: { id: warehouse.distributorId },
            })
          ).territoryId,
        },
      });
      if (!driver)
        throw new BadRequestException(
          "Assign an SR or distributor user from this territory",
        );
      const orders = await tx.secondaryOrder.findMany({
        where: {
          id: { in: d.orderIds },
          distributorId: warehouse.distributorId,
          status: { in: ["ALLOCATED", "DISPATCHED"] },
        },
        include: {
          outlet: true,
          lines: {
            include: {
              sku: true,
              batchAllocations: { include: { batch: true } },
            },
          },
          tripStops: {
            where: { trip: { status: { in: ["PLANNED", "IN_PROGRESS"] } } },
          },
        },
      });
      if (
        orders.length !== d.orderIds.length ||
        orders.some((o) => o.tripStops.length)
      )
        throw new ConflictException(
          "Select allocated/dispatched orders with no active trip",
        );
      if (orders.some((o) => o.outlet.lat === null || o.outlet.lng === null))
        throw new BadRequestException(
          "All delivery outlets need GPS coordinates before route planning",
        );
      if (
        orders.some((o) =>
          o.lines.some((l) =>
            l.batchAllocations.some(
              (a) => !a.restored && a.batch.warehouseId !== warehouse.id,
            ),
          ),
        )
      )
        throw new ConflictException(
          "Allocated stock belongs to a different departure warehouse. Plan orders from their actual fulfillment warehouse.",
        );
      const loadKg = orders.reduce(
        (s, o) =>
          s +
          o.lines.reduce(
            (n, l) =>
              n +
              ((l.allocatedQty + l.allocatedFreeQty) * l.sku.weightGrams) /
                1000,
            0,
          ),
        0,
      );
      if (loadKg > vehicle.capacityKg)
        throw new ConflictException(
          `Load ${loadKg.toFixed(1)} kg exceeds vehicle capacity ${vehicle.capacityKg} kg`,
        );
      const optimized = optimizeStops(
        warehouse,
        orders.map((o) => ({
          id: o.id,
          lat: o.outlet.lat!,
          lng: o.outlet.lng!,
        })),
      );
      const result = await tx.deliveryTrip.create({
        data: {
          number: `TRIP-${randomUUID().slice(0, 8).toUpperCase()}`,
          distributorId: warehouse.distributorId,
          warehouseId: warehouse.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          scheduledOn: d.scheduledOn,
          distanceKm: optimized.distanceKm,
          loadKg,
          stops: {
            create: optimized.stops.map((o, i) => ({
              orderId: o.id,
              sequence: i + 1,
            })),
          },
        },
      });
      await audit(tx, u, "TRIP_PLANNED", result.id, {
        estimatedDistanceKm: optimized.distanceKm,
        loadKg,
      });
      return result;
    });
  }
  async tripAction(u: Actor, id: string, status: string) {
    return this.db.serial(async (tx) => {
      const trip = await tx.deliveryTrip.findUnique({
        where: { id },
        include: { stops: { include: { order: true } } },
      });
      if (!trip) throw new NotFoundException();
      await checkDistributor(tx, u, trip.distributorId);
      if (u.role === "SR" && trip.driverId !== u.id)
        throw new ForbiddenException();
      if (![...operators, "SR"].includes(u.role))
        throw new ForbiddenException();
      if (status === "IN_PROGRESS" && trip.status === "PLANNED") {
        if (
          await tx.deliveryTrip.findFirst({
            where: {
              id: { not: id },
              status: "IN_PROGRESS",
              OR: [{ vehicleId: trip.vehicleId }, { driverId: trip.driverId }],
            },
          })
        )
          throw new ConflictException(
            "Vehicle or driver already has an active trip",
          );
        for (const stop of trip.stops) {
          if (stop.order.status === "ALLOCATED")
            await this.orders.transitionInTransaction(
              u,
              stop.orderId,
              "DISPATCHED",
              tx,
              { distributorId: trip.distributorId },
            );
          else if (stop.order.status !== "DISPATCHED")
            throw new ConflictException("An order is no longer dispatchable");
        }
      } else if (status === "CLOSED" && trip.status === "IN_PROGRESS") {
        if (trip.stops.some((s) => s.status === "PENDING"))
          throw new ConflictException(
            "Resolve every stop before closing the trip",
          );
      } else if (!(status === "CANCELLED" && trip.status === "PLANNED"))
        throw new ConflictException("Invalid trip transition");
      await audit(tx, u, `TRIP_${status}`, id);
      return tx.deliveryTrip.update({
        where: { id },
        data: {
          status,
          ...(status === "IN_PROGRESS"
            ? { startedAt: new Date() }
            : status === "CLOSED"
              ? { closedAt: new Date() }
              : {}),
        },
      });
    });
  }
  async stop(u: Actor, id: string, body: unknown) {
    const d = parse(
      z
        .object({
          status: z.enum(["DELIVERED", "FAILED"]),
          recipientName: z.string().trim().max(200).default(""),
          proofReference: z.string().max(300).default(""),
          note: z.string().max(500).default(""),
          lat: z.number().min(-90).max(90).optional(),
          lng: z.number().min(-180).max(180).optional(),
        })
        .refine(
          (d) =>
            d.status === "FAILED"
              ? d.note.trim().length >= 10
              : d.recipientName.length >= 2 &&
                d.proofReference.trim().length >= 3,
          {
            message:
              "Delivery requires recipient and POD reference; failure requires a detailed reason",
          },
        ),
      body,
    );
    return this.db.serial(async (tx) => {
      const stop = await tx.tripStop.findUnique({
        where: { id },
        include: { trip: true },
      });
      if (!stop) throw new NotFoundException();
      await checkDistributor(tx, u, stop.trip.distributorId);
      if (
        ![...operators, "SR"].includes(u.role) ||
        (u.role === "SR" && stop.trip.driverId !== u.id)
      )
        throw new ForbiddenException();
      if (stop.trip.status !== "IN_PROGRESS" || stop.status !== "PENDING")
        throw new ConflictException("This stop is not awaiting completion");
      if (d.status === "DELIVERED")
        await this.orders.transitionInTransaction(
          u,
          stop.orderId,
          "DELIVERED",
          tx,
          { distributorId: stop.trip.distributorId },
        );
      await audit(tx, u, `STOP_${d.status}`, id, {
        proof: d.proofReference,
        reason: d.note,
      });
      return tx.tripStop.update({
        where: { id },
        data: { ...d, completedAt: new Date() },
      });
    });
  }
  async task(u: Actor, body: unknown) {
    permit(u, managers);
    const d = parse(
      z.object({
        title: text,
        type: z.enum([
          "MERCHANDISING",
          "PRICE_AUDIT",
          "COMPETITOR",
          "ASSORTMENT",
          "FOLLOW_UP",
        ]),
        outletId: text,
        assignedTo: text,
        dueOn: z.iso.datetime(),
        priority: z.enum(["NORMAL", "HIGH", "URGENT"]),
        checklist: z.array(text).min(1).max(30),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const outlet = await tx.outlet.findFirst({
        where: { id: d.outletId, ...outletScope(u) },
        include: { beat: true },
      });
      const assignee = await tx.user.findFirst({
        where: { id: d.assignedTo, role: "SR", ...userScope(u) },
      });
      if (
        !outlet ||
        !assignee ||
        assignee.territoryId !== outlet.beat.territoryId
      )
        throw new BadRequestException(
          "Task outlet and sales rep must share a territory",
        );
      return tx.fieldTask.create({ data: { ...d, createdBy: u.id } });
    });
  }
  async completeTask(u: Actor, id: string, body: unknown) {
    const d = parse(
      z.object({
        checks: z.array(z.boolean()).min(1).max(30),
        notes: z.string().max(1000),
        evidenceReference: z.string().max(300).default(""),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const task = await tx.fieldTask.findFirst({
        where: { id, outlet: outletScope(u) },
      });
      if (!task) throw new NotFoundException();
      if (u.id !== task.assignedTo && !managers.includes(u.role))
        throw new ForbiddenException();
      if (!["OPEN", "IN_PROGRESS"].includes(task.status))
        throw new ConflictException("Task already completed");
      if (
        d.checks.length !== (task.checklist as string[]).length ||
        !d.checks.every(Boolean)
      )
        throw new BadRequestException("Complete every checklist item");
      if (task.type !== "FOLLOW_UP" && !d.evidenceReference.trim())
        throw new BadRequestException(
          "Evidence reference is required for this audit",
        );
      await audit(tx, u, "FIELD_TASK_COMPLETED", id);
      return tx.fieldTask.update({
        where: { id },
        data: {
          status: "COMPLETED",
          result: { checks: d.checks, notes: d.notes },
          evidenceReference: d.evidenceReference,
          completedAt: new Date(),
        },
      });
    });
  }
  async opportunity(u: Actor, body: unknown) {
    permit(u, sellers);
    const d = parse(
      z.object({
        title: text,
        outletId: text,
        valueMinor: minor.refine((n) => n > 0),
        expectedOn: z.iso.datetime(),
        notes: z.string().max(1000).default(""),
      }),
      body,
    );
    const outlet = await this.db.outlet.findFirst({
      where: { id: d.outletId, ...outletScope(u) },
      include: { beat: true },
    });
    if (!outlet) throw new NotFoundException();
    return this.db.salesOpportunity.create({
      data: { ...d, assignedTo: u.id, territoryId: outlet.beat.territoryId },
    });
  }
  async stage(u: Actor, id: string, body: unknown) {
    const d = parse(
      z.object({
        stage: z.enum(["QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]),
      }),
      body,
    );
    const item = await this.db.salesOpportunity.findFirst({
      where: {
        id,
        ...(u.role === "COMPANY_ADMIN"
          ? {}
          : { territoryId: u.territoryId || "__none" }),
      },
    });
    if (!item) throw new NotFoundException();
    if (item.assignedTo !== u.id && !managers.includes(u.role))
      throw new ForbiddenException();
    const allowed: Record<string, string[]> = {
      QUALIFIED: ["PROPOSAL", "LOST"],
      PROPOSAL: ["NEGOTIATION", "LOST"],
      NEGOTIATION: ["WON", "LOST"],
    };
    if (!allowed[item.stage]?.includes(d.stage))
      throw new ConflictException(
        "Opportunity stage transition is not allowed",
      );
    return this.db.salesOpportunity.update({ where: { id }, data: d });
  }
}
