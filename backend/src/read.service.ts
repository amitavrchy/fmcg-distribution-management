import { Inject, Injectable } from '@nestjs/common';
import { Db } from './db';
import { Actor, orderScope, outletScope, distributorScope, userScope, permit, managers } from './auth';
import { dhakaDate } from './domain/geo';
@Injectable()
export class ReadService {
  constructor(@Inject(Db) private db:Db) {}
  async snapshot(u:Actor) {
    const [outlets,orders,stock,collections,beats,distributors,skus,prices,schemes,targets,visits,users,territories,claims,invoices,runs,movements]=await Promise.all([
      this.db.outlet.findMany({where:outletScope(u),include:{beat:true},orderBy:{name:'asc'}}),
      this.db.secondaryOrder.findMany({where:orderScope(u),include:{outlet:true,sr:{select:{id:true,fullName:true}},lines:{include:{sku:true}},delivery:{include:{invoice:true}}},orderBy:{createdAt:'desc'},take:500}),
      this.db.distributorStock.findMany({where:{distributor:distributorScope(u)},include:{sku:true,distributor:true}}),
      this.db.collection.findMany({where:{outlet:outletScope(u),...(u.role==='SR'?{srId:u.id}:{})},include:{outlet:true,sr:{select:{fullName:true}}},orderBy:{collectedAt:'desc'},take:500}),
      this.db.beat.findMany({where:u.role==='COMPANY_ADMIN'?{}:{territoryId:u.territoryId||'__none'},include:{territory:true},orderBy:{name:'asc'}}),
      this.db.distributor.findMany({where:distributorScope(u)}),this.db.sku.findMany({where:{active:true},orderBy:{name:'asc'}}),
      this.db.priceList.findFirst({where:{active:true},orderBy:{version:'desc'},include:{items:true}}),this.db.scheme.findMany({orderBy:{priority:'asc'}}),
      this.db.target.findMany({where:{sr:userScope(u)},include:{sr:{select:{fullName:true}}}}),
      this.db.journeyVisit.findMany({where:{sr:userScope(u),beatDate:dhakaDate()},include:{outlet:true,sr:{select:{fullName:true}}}}),
      this.db.user.findMany({where:userScope(u),select:{id:true,fullName:true,role:true,email:true,territoryId:true}}),
      this.db.territory.findMany({where:u.role==='COMPANY_ADMIN'?{}:{id:u.territoryId||'__none'},include:{area:{include:{region:true}}}}),
      this.db.claim.findMany({where:{order:orderScope(u)},include:{order:{include:{outlet:true}}},orderBy:{createdAt:'desc'}}),
      this.db.invoice.findMany({where:{outlet:outletScope(u)},orderBy:{createdAt:'asc'}}),
      u.role==='COMPANY_ADMIN'?this.db.incentiveRun.findMany({orderBy:{periodYm:'desc'}}):Promise.resolve([]),
      this.db.stockMovement.findMany({where:{distributorId:{in:(await this.db.distributor.findMany({where:distributorScope(u),select:{id:true}})).map(d=>d.id)}},orderBy:{createdAt:'desc'},take:100})
    ]);
    return {outlets,orders,stock,collections,beats,distributors,skus,prices,schemes,targets,visits,users,territories,claims,invoices,runs,movements,serverTime:new Date().toISOString(),today:dhakaDate(),weekday:new Date().toLocaleDateString('en-US',{timeZone:'Asia/Dhaka',weekday:'long'})};
  }
  audit(u:Actor) { permit(u,managers); return this.db.auditLog.findMany({where:u.role==='COMPANY_ADMIN'?{}:{actorId:{in:this.dbUserIds(u)}},orderBy:{createdAt:'desc'},take:100}); }
  private dbUserIds(u:Actor) { return [u.id]; }
}
