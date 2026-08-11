import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface WalletTransactionView {
  id: string;
  amountPaise: number;
  balanceAfterPaise: number | null;
  type: TransactionType;
  category: string;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

export interface WalletView {
  userId: string;
  balancePaise: number;
  fanPoints: number;
  transactions: WalletTransactionView[];
}

/**
 * The customer wallet, backed by Postgres.
 *
 * Previously an in-memory `Map` that seeded every user ₹500 and exposed a
 * `topUpWallet` endpoint crediting any caller-specified amount with no payment
 * proof. Both are gone: balances live in the `wallets` table behind a
 * `balancePaise >= 0` CHECK constraint, and credits only enter through
 * `creditFromPayment` (called by the payment service after a verified capture)
 * or `refund`.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string, transactionLimit = 25): Promise<WalletView> {
    const wallet = await this.ensureWallet(userId);
    const [transactions, fanPoints] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: transactionLimit,
      }),
      this.prisma.fanPoints.findUnique({ where: { userId } }),
    ]);

    return {
      userId,
      balancePaise: wallet.balancePaise,
      fanPoints: fanPoints?.balance ?? 0,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amountPaise: tx.amountPaise,
        balanceAfterPaise: tx.balanceAfterPaise,
        type: tx.type,
        category: tx.category,
        description: tx.description,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt.toISOString(),
      })),
    };
  }

  async getBalancePaise(userId: string): Promise<number> {
    const wallet = await this.ensureWallet(userId);
    return wallet.balancePaise;
  }

  /** Creates the wallet row on first use. Idempotent under concurrency. */
  async ensureWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balancePaise: 0 },
    });
  }

  /**
   * Debits the wallet inside the caller's transaction.
   *
   * The conditional `updateMany` is the correctness crux: two concurrent debits
   * both read the same balance, but only one satisfies `balancePaise >= amount`.
   * The DB CHECK constraint is the backstop if this predicate is ever bypassed.
   */
  async debitWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    amountPaise: number,
    description: string,
    referenceId?: string,
    category = 'order',
  ): Promise<number> {
    this.assertPositive(amountPaise);

    const { count } = await tx.wallet.updateMany({
      where: { userId, balancePaise: { gte: amountPaise } },
      data: { balancePaise: { decrement: amountPaise } },
    });
    if (count === 0) {
      throw new BadRequestException('Insufficient wallet balance.');
    }

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    await tx.walletTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        amountPaise,
        balanceAfterPaise: wallet.balancePaise,
        type: TransactionType.deduct,
        category,
        description,
        referenceId: referenceId ?? null,
      },
    });
    return wallet.balancePaise;
  }

  /** Credits the wallet inside the caller's transaction. */
  async creditWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    amountPaise: number,
    description: string,
    referenceId?: string,
    type: TransactionType = TransactionType.topup,
    category = 'topup',
  ): Promise<number> {
    this.assertPositive(amountPaise);

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: { balancePaise: { increment: amountPaise } },
      create: { userId, balancePaise: amountPaise },
    });

    await tx.walletTransaction.create({
      data: {
        userId,
        walletId: wallet.id,
        amountPaise,
        balanceAfterPaise: wallet.balancePaise,
        type,
        category,
        description,
        referenceId: referenceId ?? null,
      },
    });
    return wallet.balancePaise;
  }

  /**
   * Credits a wallet after a payment has been verified.
   *
   * `referenceId` is the provider payment id; the caller must have confirmed it
   * with the gateway first. There is deliberately no public "add money" method
   * that trusts an amount from the client.
   */
  async creditFromPayment(userId: string, amountPaise: number, referenceId: string, description = 'Wallet top-up'): Promise<WalletView> {
    this.assertPositive(amountPaise);

    // A replayed capture must not credit twice.
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { userId, referenceId, type: TransactionType.topup },
    });
    if (existing) {
      this.logger.warn(`Ignoring duplicate wallet credit for reference ${referenceId}.`);
      return this.getWallet(userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.creditWithin(tx, userId, amountPaise, description, referenceId);
      // 1 fan point per ₹10 added.
      const points = Math.floor(amountPaise / 1000);
      if (points > 0) {
        await tx.fanPoints.upsert({
          where: { userId },
          update: { balance: { increment: points } },
          create: { userId, balance: points },
        });
      }
    });

    return this.getWallet(userId);
  }

  /** Returns money to the wallet, e.g. when an order is cancelled or refunded. */
  async refund(userId: string, amountPaise: number, referenceId: string, description = 'Order refund'): Promise<WalletView> {
    this.assertPositive(amountPaise);

    const existing = await this.prisma.walletTransaction.findFirst({
      where: { userId, referenceId, type: TransactionType.refund },
    });
    if (existing) {
      this.logger.warn(`Ignoring duplicate refund for reference ${referenceId}.`);
      return this.getWallet(userId);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.creditWithin(tx, userId, amountPaise, description, referenceId, TransactionType.refund, 'refund');
    });
    return this.getWallet(userId);
  }

  private assertPositive(amountPaise: number): void {
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException('Amount must be a positive whole number of paise.');
    }
  }
}
