import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
@Injectable()
export class Db extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
  async serial<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.$transaction(work, {
          isolationLevel: "Serializable",
          timeout: 15000,
        });
      } catch (e) {
        if (
          attempt < 3 &&
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2034"
        )
          continue;
        throw e;
      }
    }
  }
}
