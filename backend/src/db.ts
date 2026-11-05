import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
@Injectable()
export class Db extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() { await this.$disconnect(); }
  async serial<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt=0;;attempt++) {
      try { return await this.$transaction(work,{isolationLevel:'Serializable',timeout:15000}); }
      catch (e) { if (attempt<3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2034') continue; throw e; }
    }
  }
}
