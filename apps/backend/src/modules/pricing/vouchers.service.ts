import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FEATURES } from '../../common/config/env';

export interface VoucherEvaluation {
  valid: boolean;
  code: string;
  voucherId: string | null;
  discountPaise: number;
  message: string;
}

/**
 * Promo codes, moved out of the frontend `PricingEngine.validateVoucher` — which
 * hardcoded three codes with no expiry, no usage cap, and no per-user limit, and
 * ran in the browser where anyone could read (or fake) the result.
 *
 * Redemption is recorded transactionally alongside the order, so a code with a
 * cap of one cannot be spent twice by racing requests.
 */
@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The offers screen lists only what can actually be redeemed, so it never
   * suggests a code the checkout will reject. The signed-in user's own history
   * is folded in — a per-user limit of one is invisible to someone who has
   * already spent it if the list is judged purely on global counts.
   */
  async listActive(userId: string): Promise<
    Array<{
      code: string;
      description: string;
      discountType: string;
      discountValue: number;
      maxDiscountPaise: number | null;
      minSubtotalPaise: number;
      perUserLimit: number;
      remainingForUser: number;
    }>
  > {
    if (!FEATURES.loyaltyAndVouchersEnabled) {
      return [];
    }
    const now = new Date();
    const [rows, mine] = await Promise.all([
      this.prisma.voucher.findMany({
        where: {
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        orderBy: { minSubtotalPaise: 'asc' },
        select: {
          id: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          maxDiscountPaise: true,
          minSubtotalPaise: true,
          perUserLimit: true,
          redemptionCount: true,
          maxRedemptions: true,
        },
      }),
      this.prisma.voucherRedemption.groupBy({
        by: ['voucherId'],
        where: { userId },
        _count: { voucherId: true },
      }),
    ]);

    const usedByMe = new Map(mine.map((row) => [row.voucherId, row._count.voucherId]));
    return rows
      // A globally exhausted code is dead for everyone; showing it is just an
      // invitation to type it and be told no.
      .filter((row) => row.maxRedemptions === null || row.redemptionCount < row.maxRedemptions)
      .map((row) => ({
        code: row.code,
        description: row.description,
        discountType: row.discountType,
        discountValue: row.discountValue,
        maxDiscountPaise: row.maxDiscountPaise,
        minSubtotalPaise: row.minSubtotalPaise,
        perUserLimit: row.perUserLimit,
        remainingForUser: Math.max(0, row.perUserLimit - (usedByMe.get(row.id) ?? 0)),
      }))
      .filter((row) => row.remainingForUser > 0);
  }

  /**
   * Checks a code and computes what it is worth for this cart. Never throws for
   * an invalid code — an unrecognised promo should show a message, not fail the
   * whole quote.
   */
  async evaluate(rawCode: string, userId: string, subtotalPaise: number): Promise<VoucherEvaluation> {
    const code = rawCode.trim().toUpperCase();
    const invalid = (message: string): VoucherEvaluation => ({
      valid: false,
      code,
      voucherId: null,
      discountPaise: 0,
      message,
    });

    if (!FEATURES.loyaltyAndVouchersEnabled) {
      return invalid('Loyalty points and vouchers are currently disabled.');
    }

    if (!code) return invalid('Enter a voucher code.');

    const voucher = await this.prisma.voucher.findUnique({ where: { code } });
    if (!voucher || !voucher.isActive) return invalid('Invalid or expired voucher code.');

    const now = new Date();
    if (voucher.validFrom > now) return invalid('This voucher is not active yet.');
    if (voucher.validUntil && voucher.validUntil < now) return invalid('This voucher has expired.');

    if (subtotalPaise < voucher.minSubtotalPaise) {
      const shortfall = (voucher.minSubtotalPaise - subtotalPaise) / 100;
      return invalid(`Add ₹${shortfall.toFixed(0)} more to use this voucher.`);
    }

    if (voucher.maxRedemptions !== null && voucher.redemptionCount >= voucher.maxRedemptions) {
      return invalid('This voucher has been fully claimed.');
    }

    const usedByUser = await this.prisma.voucherRedemption.count({
      where: { voucherId: voucher.id, userId },
    });
    if (usedByUser >= voucher.perUserLimit) {
      return invalid('You have already used this voucher.');
    }

    const discountPaise = this.discountFor(voucher, subtotalPaise);
    if (discountPaise <= 0) return invalid('This voucher does not apply to your cart.');

    return {
      valid: true,
      code,
      voucherId: voucher.id,
      discountPaise,
      message: voucher.description || `Voucher ${code} applied.`,
    };
  }

  /**
   * Records a redemption inside the caller's transaction.
   *
   * The conditional `updateMany` is what enforces the global cap under
   * concurrency: two simultaneous redemptions of a one-use code both read
   * `redemptionCount = 0`, but only one satisfies the `lt` predicate.
   */
  async recordRedemption(
    tx: Prisma.TransactionClient,
    voucherId: string,
    userId: string,
    orderId: string,
    discountPaise: number,
  ): Promise<boolean> {
    const voucher = await tx.voucher.findUnique({ where: { id: voucherId }, select: { maxRedemptions: true } });
    if (!voucher) return false;

    const { count } = await tx.voucher.updateMany({
      where:
        voucher.maxRedemptions === null
          ? { id: voucherId, isActive: true }
          : { id: voucherId, isActive: true, redemptionCount: { lt: voucher.maxRedemptions } },
      data: { redemptionCount: { increment: 1 } },
    });
    if (count === 0) return false;

    await tx.voucherRedemption.create({
      data: { voucherId, userId, orderId, discountPaise },
    });
    return true;
  }

  /** Releases a redemption when the order it backed never completes. */
  async releaseRedemption(tx: Prisma.TransactionClient, voucherId: string, orderId: string): Promise<void> {
    const deleted = await tx.voucherRedemption.deleteMany({ where: { voucherId, orderId } });
    if (deleted.count > 0) {
      await tx.voucher.update({
        where: { id: voucherId },
        data: { redemptionCount: { decrement: deleted.count } },
      });
    }
  }

  private discountFor(
    voucher: { discountType: string; discountValue: number; maxDiscountPaise: number | null },
    subtotalPaise: number,
  ): number {
    const raw =
      voucher.discountType === 'percent'
        ? Math.round((subtotalPaise * voucher.discountValue) / 100)
        : voucher.discountValue;

    const capped = voucher.maxDiscountPaise !== null ? Math.min(raw, voucher.maxDiscountPaise) : raw;
    return Math.max(0, Math.min(capped, subtotalPaise));
  }
}
