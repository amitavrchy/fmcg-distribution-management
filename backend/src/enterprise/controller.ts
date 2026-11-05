import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { Request } from "express";
import { Actor, AuthGuard } from "../auth";
import { parse } from "../validation";
import { Cache } from "../cache";
import { Realtime } from "../realtime";
import { EnterpriseRead } from "./read.service";
import { WarehouseService } from "./warehouse.service";
import { ProcurementService } from "./procurement.service";
import { ReturnsService } from "./returns.service";
import { FinanceService } from "./finance.service";
import { FieldService } from "./field.service";
import { ImportService } from "./import.service";
type Authed = Request & { user: Actor };
@Controller("api/enterprise")
@UseGuards(AuthGuard)
export class EnterpriseController {
  constructor(
    @Inject(EnterpriseRead) private read: EnterpriseRead,
    @Inject(WarehouseService) private stock: WarehouseService,
    @Inject(ProcurementService) private procurement: ProcurementService,
    @Inject(ReturnsService) private returns: ReturnsService,
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(FieldService) private field: FieldService,
    @Inject(Cache) private cache: Cache,
    @Inject(Realtime) private realtime: Realtime,
    @Inject(ImportService) private imports: ImportService,
  ) {}
  @Post("imports/outlets/preview") previewImport(
    @Req() r: Authed,
    @Body() b: unknown,
  ) {
    return this.imports.preview(r.user, b);
  }
  @Post("imports/outlets/apply") applyImport(
    @Req() r: Authed,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.imports.apply(r.user, b));
  }
  async change<T>(u: Actor, result: Promise<T>) {
    const value = await result;
    await this.cache.invalidate();
    this.realtime.changed(u);
    return value;
  }
  @Get("snapshot") async snapshot(@Req() r: Authed) {
    await this.stock.bootstrap(r.user);
    return this.read.snapshot(r.user);
  }
  @Post("warehouses") warehouse(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.stock.create(r.user, b));
  }
  @Patch("batches/:id") batch(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.stock.batchStatus(r.user, id, b));
  }
  @Post("transfers") transfer(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.stock.transfer(r.user, b));
  }
  @Patch("transfers/:id") transferAction(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(
      z.object({ status: z.enum(["IN_TRANSIT", "RECEIVED", "CANCELLED"]) }),
      b,
    );
    return this.change(r.user, this.stock.transferAction(r.user, id, d.status));
  }
  @Post("counts") count(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.stock.count(r.user, b));
  }
  @Patch("counts/:id") countAction(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(z.object({ status: z.enum(["APPROVED", "REJECTED"]) }), b);
    return this.change(r.user, this.stock.approveCount(r.user, id, d.status));
  }
  @Post("suppliers") supplier(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.procurement.supplier(r.user, b));
  }
  @Post("purchases") purchase(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.procurement.create(r.user, b));
  }
  @Patch("purchases/:id") purchaseAction(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(z.object({ status: z.enum(["APPROVED", "CANCELLED"]) }), b);
    return this.change(r.user, this.procurement.approve(r.user, id, d.status));
  }
  @Post("purchases/:id/receive") receive(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.procurement.receive(r.user, id, b));
  }
  @Post("payables/:id/pay") pay(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.procurement.pay(r.user, id, b));
  }
  @Post("returns") requestReturn(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.returns.create(r.user, b));
  }
  @Patch("returns/:id") returnReview(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(z.object({ status: z.enum(["APPROVED", "REJECTED"]) }), b);
    return this.change(r.user, this.returns.review(r.user, id, d.status));
  }
  @Post("returns/:id/receive") returnReceipt(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.returns.receive(r.user, id, b));
  }
  @Post("credits/:id/refund") refund(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.returns.refund(r.user, id, b));
  }
  @Post("expenses") expense(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.finance.expense(r.user, b));
  }
  @Patch("expenses/:id") reviewExpense(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(z.object({ status: z.enum(["APPROVED", "REJECTED"]) }), b);
    return this.change(
      r.user,
      this.finance.reviewExpense(r.user, id, d.status),
    );
  }
  @Post("expenses/:id/pay") payExpense(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.finance.payExpense(r.user, id, b));
  }
  @Post("handovers") handover(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.finance.handover(r.user, b));
  }
  @Post("handovers/:id/receive") handoverReview(
    @Req() r: Authed,
    @Param("id") id: string,
  ) {
    return this.change(r.user, this.finance.acceptHandover(r.user, id));
  }
  @Post("vehicles") vehicle(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.field.vehicle(r.user, b));
  }
  @Post("trips") trip(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.field.trip(r.user, b));
  }
  @Patch("trips/:id") tripAction(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    const d = parse(
      z.object({ status: z.enum(["IN_PROGRESS", "CLOSED", "CANCELLED"]) }),
      b,
    );
    return this.change(r.user, this.field.tripAction(r.user, id, d.status));
  }
  @Patch("stops/:id") stop(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.field.stop(r.user, id, b));
  }
  @Post("tasks") task(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.field.task(r.user, b));
  }
  @Post("tasks/:id/complete") complete(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.field.completeTask(r.user, id, b));
  }
  @Post("opportunities") opportunity(@Req() r: Authed, @Body() b: unknown) {
    return this.change(r.user, this.field.opportunity(r.user, b));
  }
  @Patch("opportunities/:id") stage(
    @Req() r: Authed,
    @Param("id") id: string,
    @Body() b: unknown,
  ) {
    return this.change(r.user, this.field.stage(r.user, id, b));
  }
}
