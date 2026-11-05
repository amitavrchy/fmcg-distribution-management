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
        const adapterError = e as {
          cause?: { kind?: string; originalCode?: string };
        };
        if (
          attempt < 5 &&
          ((e instanceof Prisma.PrismaClientKnownRequestError &&
            ["P2034", "P2002"].includes(e.code)) ||
            adapterError.cause?.kind === "TransactionWriteConflict" ||
            ["40001", "40P01"].includes(adapterError.cause?.originalCode || ""))
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 25),
          );
          continue;
        }
        throw e;
      }
    }
  }
}
