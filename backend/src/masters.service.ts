import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Db } from './db';
import { Actor, managers, operators, permit, outletScope, distributorScope } from './auth';
import { minor, parse, text, quantity } from './validation';
@Injectable()
export class MastersService {
  constructor(@Inject(Db) private db:Db) {}
  async save(u:Actor,kind:string,body:unknown) {
    permit(u,managers);
    if(kind==='outlets') {
      const d=parse(z.object({name:text,code:text,owner:text,phone:z.string().regex(/^01\d{9}$/),address:text,beatId:text,channel:z.enum(['GENERAL','PHARMACY','HOTEL']),creditLimitMinor:minor,lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional()}),body);
      if(!await this.db.beat.findFirst({where:{id:d.beatId,...(u.role==='COMPANY_ADMIN'?{}:{territoryId:u.territoryId||'__none'})}})) throw new NotFoundException('Beat is outside your territory');
      return this.db.outlet.create({data:d});
    }
    if(kind==='skus') {
      permit(u,['COMPANY_ADMIN']);
      const d=parse(z.object({name:text,code:text,category:text,unit:text,packSize:quantity,reorderLevel:z.number().int().min(0).max(100000),priceMinor:minor}),body);
      return this.db.serial(async tx=>{
        const {priceMinor,...sku}=d, result=await tx.sku.create({data:sku});
        const price=await tx.priceList.findFirst({where:{active:true},orderBy:{version:'desc'},include:{items:true}});
        const next=await tx.priceList.create({data:{name:'Standard trade price',version:(price?.version||0)+1,items:{create:[...(price?.items.map(i=>({skuId:i.skuId,priceMinor:i.priceMinor}))||[]),{skuId:result.id,priceMinor}]}}});
        if(price) await tx.priceList.update({where:{id:price.id},data:{active:false}});
        return {...result,version:next.version};
      });
    }
    if(kind==='beats') {
      const d=parse(z.object({name:text,territoryId:text,weekday:z.number().int().min(0).max(6)}),body);
      if(u.role!=='COMPANY_ADMIN'&&d.territoryId!==u.territoryId) throw new BadRequestException('Territory is outside your scope');
      return this.db.beat.create({data:d});
    }
    if(kind==='distributors') { const d=parse(z.object({name:text,code:text,territoryId:text}),body); if(u.role!=='COMPANY_ADMIN'&&d.territoryId!==u.territoryId) throw new BadRequestException('Territory is outside your scope'); return this.db.distributor.create({data:d}); }
    if(kind==='schemes') {
      permit(u,['COMPANY_ADMIN']);
      const rule=z.discriminatedUnion('type',[
        z.object({type:z.literal('PERCENT'),value:z.number().min(0).max(100),minMinor:minor}),
        z.object({type:z.literal('AMOUNT'),value:minor,minMinor:minor}),
        z.object({type:z.literal('FREE'),skuId:text,buyQty:quantity,freeQty:quantity}),
        z.object({type:z.literal('COMBO'),requires:z.array(text).min(2),value:minor,minMinor:minor})]);
      const d=parse(z.object({name:text,priority:z.number().int().min(0).max(10000),startsOn:z.iso.datetime(),endsOn:z.iso.datetime(),rules:rule}).refine(d=>d.endsOn>d.startsOn,{message:'End date must follow start date'}),body);
      return this.db.scheme.create({data:d});
    }
    throw new BadRequestException('Unsupported resource');
  }
  async receive(u:Actor,body:unknown) {
    permit(u,operators);
    const d=parse(z.object({distributorId:text,skuId:text,qty:quantity,reference:text}),body);
    if(!await this.db.distributor.findFirst({where:{id:d.distributorId,...distributorScope(u)}})) throw new NotFoundException();
    return this.db.serial(async tx=>{
      const stock=await tx.distributorStock.upsert({where:{distributorId_skuId:{distributorId:d.distributorId,skuId:d.skuId}},create:{distributorId:d.distributorId,skuId:d.skuId,qty:d.qty},update:{qty:{increment:d.qty}}});
      await tx.stockMovement.create({data:{...d,kind:'PRIMARY_RECEIPT'}});
      await tx.auditLog.create({data:{actorId:u.id,action:'STOCK_RECEIVED',entityId:stock.id,details:d}}); return stock;
    });
  }
  async transfer(u:Actor,id:string,body:unknown) {
    permit(u,managers); const d=parse(z.object({beatId:text,creditLimitMinor:minor.optional()}),body);
    const outlet=await this.db.outlet.findFirst({where:{id,...outletScope(u)}});
    const beat=await this.db.beat.findFirst({where:{id:d.beatId,...(u.role==='COMPANY_ADMIN'?{}:{territoryId:u.territoryId||'__none'})}});
    if(!outlet||!beat) throw new NotFoundException();
    return this.db.serial(async tx=>{ await tx.auditLog.create({data:{actorId:u.id,action:'OUTLET_TRANSFERRED',entityId:id,details:{from:outlet.beatId,to:beat.id}}}); return tx.outlet.update({where:{id},data:d}); });
  }
}
