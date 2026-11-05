import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Actor, AuthGuard } from './auth';
import { ReadService } from './read.service';
import { MastersService } from './masters.service';
import { OrdersService } from './orders.service';
import { CollectionsService } from './collections.service';
import { JourneyService } from './journey.service';
import { IncentivesService } from './incentives.service';
import { ClaimsService } from './claims.service';
import { Realtime } from './realtime';
import { parse,text } from './validation';
import { z } from 'zod';
type Authed=Request & {user:Actor};
@Controller('api') @UseGuards(AuthGuard)
export class AppController {
  constructor(@Inject(ReadService) private read:ReadService,@Inject(MastersService) private masters:MastersService,@Inject(OrdersService) private orders:OrdersService,@Inject(CollectionsService) private collections:CollectionsService,@Inject(JourneyService) private journey:JourneyService,@Inject(IncentivesService) private incentives:IncentivesService,@Inject(ClaimsService) private claims:ClaimsService,@Inject(Realtime) private realtime:Realtime) {}
  private async change<T>(u:Actor,work:Promise<T>) {const result=await work;this.realtime.changed(u);return result;}
  @Get('snapshot') snapshot(@Req() r:Authed) {return this.read.snapshot(r.user);}
  @Get('dashboard') dashboard(@Req() r:Authed) {return this.read.snapshot(r.user);}
  @Get('audit') audit(@Req() r:Authed) {return this.read.audit(r.user);}
  @Get('sr/today-beat') today(@Req() r:Authed) {return this.read.snapshot(r.user).then(d=>({beats:d.beats,outlets:d.outlets,visits:d.visits,today:d.today}));}
  @Get('sync/pull') pull(@Req() r:Authed,@Query('since') _since?:string) {return this.read.snapshot(r.user);}
  @Post('masters/:kind') master(@Req() r:Authed,@Param('kind') kind:string,@Body() b:unknown) {return this.change(r.user,this.masters.save(r.user,kind,b));}
  @Patch('outlets/:id') transfer(@Req() r:Authed,@Param('id') id:string,@Body() b:unknown) {return this.change(r.user,this.masters.transfer(r.user,id,b));}
  @Post('stock/receive') receive(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.masters.receive(r.user,b));}
  @Post('orders') order(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.orders.create(r.user,b));}
  @Post('orders/preview') preview(@Req() r:Authed,@Body() b:unknown) {return this.orders.create(r.user,b,true);}
  @Patch('orders/:id/status') status(@Req() r:Authed,@Param('id') id:string,@Body() b:unknown) {return this.change(r.user,this.orders.transition(r.user,id,parse(z.object({status:text}),b).status));}
  @Post('collections') collection(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.collections.create(r.user,b));}
  @Patch('collections/:id/status') reconcile(@Req() r:Authed,@Param('id') id:string,@Body() b:unknown) {return this.change(r.user,this.collections.reconcile(r.user,id,parse(z.object({status:z.enum(['RECONCILED','BOUNCED'])}),b).status));}
  @Post('sr/visits') visit(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.journey.visit(r.user,b));}
  @Post('targets') target(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.incentives.target(r.user,b));}
  @Post('incentives/runs') run(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.incentives.run(r.user,b));}
  @Patch('incentives/runs/:id') approve(@Req() r:Authed,@Param('id') id:string,@Body() b:unknown) {return this.change(r.user,this.incentives.approve(r.user,id,parse(z.object({status:z.enum(['APPROVED','PAID'])}),b).status));}
  @Post('claims') claim(@Req() r:Authed,@Body() b:unknown) {return this.change(r.user,this.claims.create(r.user,b));}
  @Patch('claims/:id') review(@Req() r:Authed,@Param('id') id:string,@Body() b:unknown) {return this.change(r.user,this.claims.review(r.user,id,parse(z.object({status:z.enum(['APPROVED','REJECTED'])}),b).status));}
  @Post('sync/push') async sync(@Req() r:Authed,@Body() body:unknown) {
    const {items}=parse(z.object({items:z.array(z.object({id:z.uuid(),type:z.enum(['ORDER','COLLECTION']),payload:z.unknown()})).max(100)}),body);
    const results=[];
    for(const item of items) {try {const data=await (item.type==='ORDER'?this.orders.create(r.user,item.payload):this.collections.create(r.user,item.payload));results.push({id:item.id,ok:true,data});} catch(e) {results.push({id:item.id,ok:false,error:e instanceof Error?e.message:'Sync failed'});}}
    this.realtime.changed(r.user);return {results};
  }
}
