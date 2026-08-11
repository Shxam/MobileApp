import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Interactive-transaction budget.
 *
 * Prisma defaults to a 5 s timeout, which assumes a database on the same
 * network. Ours is Neon over the public internet, so every statement inside a
 * transaction pays real round-trip latency and the multi-statement flows —
 * claim slot, insert booking, debit wallet, write ledger — blew the default and
 * surfaced as a 500 ("Transaction already closed"). Set once here rather than
 * per call site so no future transaction inherits the wrong assumption.
 *
 * These are ceilings, not targets: transactions hold row locks for their
 * duration, so the value is generous enough for a slow round trip and still
 * bounded well below any user-visible hang.
 */
const TRANSACTION_TIMEOUT_MS = 15_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      transactionOptions: {
        timeout: TRANSACTION_TIMEOUT_MS,
        maxWait: TRANSACTION_MAX_WAIT_MS,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('⚡ Connected to PostgreSQL database via Prisma ORM');
    } catch (err: any) {
      this.logger.warn(`PostgreSQL connection deferred: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
