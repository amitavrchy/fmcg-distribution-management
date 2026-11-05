import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Db } from './db';
import { Actor, managers, operators, sellers, orderScope, permit } from './auth';
import { parse,minor,text } from './validation';
@Injectable()
export class ClaimsService {
  constructor(@Inject(Db) private db:Db) {}
  async create(u:Actor,body:unknown) {
    permit(u,[...operators,...sellers]); const d=parse(z.object({orderId:text,reason:z.string().trim().min(10).max(1000),amountMinor:minor.refine(n=>n>0)}),body);
    return this.db.serial(async tx=>{
      const order=await tx.secondaryOrder.findFirst({where:{id:d.orderId,status:'DELIVERED',...orderScope(u)},include:{delivery:{include:{invoice:true}},claims:true}});
      if(!order) throw new NotFoundException('Delivered order not found');
      const claimed=order.claims.filter(c=>c.status!=='REJECTED').reduce((s,c)=>s+c.amountMinor,0);
      if(claimed+d.amountMinor>(order.delivery?.invoice?.totalMinor||0)) throw new ConflictException('Claims exceed the delivered invoice value');
      return tx.claim.create({data:d});
    });
  }
  async review(u:Actor,id:string,status:string) {
    permit(u,managers);
    if(!['APPROVED','REJECTED'].includes(status)) throw new ConflictException('Invalid claim decision');
    return this.db.serial(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,status:'SUBMITTED',order:orderScope(u)}});
      if(!claim) throw new NotFoundException('Pending claim not found');
      await tx.auditLog.create({data:{actorId:u.id,action:`CLAIM_${status}`,entityId:id,details:{amountMinor:claim.amountMinor}}});
      return tx.claim.update({where:{id},data:{status}});
    });
  }
}
