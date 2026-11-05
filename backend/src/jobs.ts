import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Db } from './db';
import { dhakaDate } from './domain/geo';
@Injectable()
export class Jobs implements OnModuleInit,OnModuleDestroy {
  private queue?:Queue; private worker?:Worker;
  constructor(@Inject(Db) private db:Db) {}
  async onModuleInit() {
    if(!process.env.REDIS_URL) return;
    const url=new URL(process.env.REDIS_URL),connection={host:url.hostname,port:Number(url.port||6379),password:url.password||undefined};
    this.queue=new Queue('distribution-maintenance',{connection});
    this.worker=new Worker('distribution-maintenance',async ()=>{
      const today=dhakaDate();
      await this.db.scheme.updateMany({where:{active:true,endsOn:{lt:new Date()}},data:{active:false}});
      const weekday=new Date().toLocaleDateString('en-US',{timeZone:'Asia/Dhaka',weekday:'long'});
      const day=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(weekday);
      const srs=await this.db.user.findMany({where:{role:'SR'}});
      for(const sr of srs) {
        const outlets=await this.db.outlet.findMany({where:{active:true,beat:{territoryId:sr.territoryId||'__none',weekday:day}}});
        await this.db.journeyVisit.createMany({data:outlets.map(o=>({srId:sr.id,outletId:o.id,beatDate:today})),skipDuplicates:true});
      }
    },{connection});
    this.worker.on('error',e=>console.error('Maintenance worker:',e.message));
    await this.queue.upsertJobScheduler('daily',{pattern:'0 0 * * *',tz:'Asia/Dhaka'},{name:'daily',data:{},opts:{removeOnComplete:30,removeOnFail:50}});
    await this.queue.add('startup',{}, {removeOnComplete:true});
  }
  async onModuleDestroy() {await this.worker?.close();await this.queue?.close();}
}
