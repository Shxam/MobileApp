import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { env, FEATURES } from '../../common/config/env';
import { VouchersService, type VoucherEvaluation } from './vouchers.service';
import {
  BENCH_DELIVERY_FEE_PAISE,
  FOOD_GST_RATE,
  HOME_DELIVERY_FEE_PAISE,
  QUOTE_TTL_SECONDS,
  applyGst,
} from './pricing.constants';

export type DeliveryType = 'turf_slot' | 'turf_bench' | 'home_delivery';

export interface PricedLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface BillBreakdown {
  subtotalPaise: number;
  gstRate: number;
  gstAmountPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
}

/** What is persisted in Redis and re-checked when the order is placed. */
export interface StoredQuote {
  quoteId: string;
  userId: string;
  lines: PricedLine[];
  bill: BillBreakdown;
  deliveryType: DeliveryType;
  promoCode: string | null;
  voucherId: string | null;
  issuedAt: string;
  expiresAt: string;
  /** HMAC over the priced content, so a tampered Redis value is detectable. */
  signature: string;
}

export interface Quote {
  quoteId: string;
  bill: BillBreakdown;
  items: PricedLine[];
  deliveryType: DeliveryType;
  promoCode: string | null;
  promoMessage: string | null;
  expiresAt: string;
}

/**
 * The single source of truth for what an order costs.
 *
 * The client sends only `{ menuItemId, quantity }`. Prices come from the
 * database, tax and fees come from `pricing.constants`, and the resulting
 * breakdown is cached under a quote id. `POST /orders` then re-prices the same
 * cart and refuses to proceed if the total has moved — so neither a tampered
 * request nor a menu edit mid-checkout can change what is charged.
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly vouchers: VouchersService,
  ) {}

  /**
   * Prices a cart from the database. Throws if any item is unknown or
   * unavailable — an unknown id is a 400, never a silently created menu item.
   */
  async priceCart(
    lines: { menuItemId: string; quantity: number }[],
    deliveryType: DeliveryType,
    userId: string,
    promoCode?: string | null,
  ): Promise<{ lines: PricedLine[]; bill: BillBreakdown; voucher: VoucherEvaluation | null }> {
    const merged = this.mergeDuplicateLines(lines);
    const ids = merged.map((line) => line.menuItemId);

    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, pricePaise: true, isAvailable: true },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown menu item(s): ${missing.join(', ')}`);
    }

    const unavailable = menuItems.filter((item) => !item.isAvailable).map((item) => item.name);
    if (unavailable.length > 0) {
      throw new BadRequestException(`Currently unavailable: ${unavailable.join(', ')}`);
    }

    const pricedLines: PricedLine[] = merged.map(({ menuItemId, quantity }) => {
      const item = byId.get(menuItemId)!;
      if (!Number.isInteger(item.pricePaise) || item.pricePaise <= 0) {
        // A non-positive price would let a crafted cart drag the total down.
        throw new BadRequestException(`"${item.name}" is not priced for sale.`);
      }
      return {
        menuItemId,
        name: item.name,
        quantity,
        unitPricePaise: item.pricePaise,
        lineTotalPaise: item.pricePaise * quantity,
      };
    });

    const subtotalPaise = pricedLines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
    const gstAmountPaise = applyGst(subtotalPaise, FOOD_GST_RATE);
    const deliveryFeePaise = this.deliveryFeeFor(deliveryType, subtotalPaise);

    const voucher = FEATURES.loyaltyAndVouchersEnabled && promoCode
      ? await this.vouchers.evaluate(promoCode, userId, subtotalPaise)
      : null;

    const grossPaise = subtotalPaise + gstAmountPaise + deliveryFeePaise;
    // A discount can never exceed the bill, so a total is never negative.
    const discountPaise = Math.min(voucher?.discountPaise ?? 0, grossPaise);

    return {
      lines: pricedLines,
      bill: {
        subtotalPaise,
        gstRate: FOOD_GST_RATE,
        gstAmountPaise,
        deliveryFeePaise,
        discountPaise,
        totalPaise: grossPaise - discountPaise,
      },
      voucher,
    };
  }

  /** Prices a cart and stores the result under a short-lived quote id. */
  async createQuote(
    userId: string,
    lines: { menuItemId: string; quantity: number }[],
    deliveryType: DeliveryType = 'turf_bench',
    promoCode?: string | null,
  ): Promise<Quote> {
    const { lines: pricedLines, bill, voucher } = await this.priceCart(lines, deliveryType, userId, promoCode);

    const quoteId = randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + QUOTE_TTL_SECONDS * 1000);

    const stored: StoredQuote = {
      quoteId,
      userId,
      lines: pricedLines,
      bill,
      deliveryType,
      promoCode: voucher?.valid ? voucher.code : null,
      voucherId: voucher?.valid ? voucher.voucherId : null,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      signature: '',
    };
    stored.signature = this.sign(stored);

    await this.redis.setJson(this.quoteKey(quoteId), stored, QUOTE_TTL_SECONDS);

    return {
      quoteId,
      bill,
      items: pricedLines,
      deliveryType,
      promoCode: stored.promoCode,
      promoMessage: voucher?.message ?? null,
      expiresAt: stored.expiresAt,
    };
  }

  /**
   * Loads a quote and re-prices it against the live menu.
   *
   * Returns the *freshly computed* bill, not the cached one — the cache is a
   * convenience, never the authority. A quote whose price has since changed is
   * rejected so the customer is asked to confirm the new total.
   */
  async redeemQuote(
    quoteId: string,
    userId: string,
  ): Promise<{ lines: PricedLine[]; bill: BillBreakdown; deliveryType: DeliveryType; promoCode: string | null; voucherId: string | null }> {
    const stored = await this.redis.getJson<StoredQuote>(this.quoteKey(quoteId));
    if (!stored) {
      throw new BadRequestException('That quote has expired. Please review your cart and try again.');
    }
    if (!this.verifySignature(stored)) {
      this.logger.error(`Quote ${quoteId} failed signature verification — discarding.`);
      await this.redis.del(this.quoteKey(quoteId));
      throw new BadRequestException('That quote is no longer valid. Please try again.');
    }
    // Scoped to the issuing user so a leaked quote id cannot be spent by anyone else.
    if (stored.userId !== userId) {
      throw new BadRequestException('That quote belongs to a different account.');
    }
    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('That quote has expired. Please review your cart and try again.');
    }

    const repriced = await this.priceCart(
      stored.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
      stored.deliveryType,
      userId,
      stored.promoCode,
    );

    if (repriced.bill.totalPaise !== stored.bill.totalPaise) {
      this.logger.warn(
        `Quote ${quoteId} repriced from ${stored.bill.totalPaise} to ${repriced.bill.totalPaise} paise; rejecting.`,
      );
      await this.redis.del(this.quoteKey(quoteId));
      throw new BadRequestException('Prices changed while you were checking out. Please review your cart.');
    }

    return {
      lines: repriced.lines,
      bill: repriced.bill,
      deliveryType: stored.deliveryType,
      promoCode: stored.promoCode,
      voucherId: stored.voucherId,
    };
  }

  /** Removes a spent quote so the same id cannot back two orders. */
  async consumeQuote(quoteId: string): Promise<void> {
    await this.redis.del(this.quoteKey(quoteId));
  }

  private deliveryFeeFor(deliveryType: DeliveryType, subtotalPaise: number): number {
    if (subtotalPaise <= 0) return 0;
    return deliveryType === 'home_delivery' ? HOME_DELIVERY_FEE_PAISE : BENCH_DELIVERY_FEE_PAISE;
  }

  /**
   * Collapses repeated ids into one line. Without this, `[{a,1},{a,1}]` and
   * `[{a,2}]` could produce different quote signatures for identical carts.
   */
  private mergeDuplicateLines(lines: { menuItemId: string; quantity: number }[]) {
    const totals = new Map<string, number>();
    for (const { menuItemId, quantity } of lines) {
      totals.set(menuItemId, (totals.get(menuItemId) ?? 0) + quantity);
    }
    return [...totals.entries()]
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));
  }

  private quoteKey(quoteId: string): string {
    return `quote:${quoteId}`;
  }

  private sign(quote: StoredQuote): string {
    const payload = JSON.stringify({
      quoteId: quote.quoteId,
      userId: quote.userId,
      lines: quote.lines,
      bill: quote.bill,
      deliveryType: quote.deliveryType,
      promoCode: quote.promoCode,
      expiresAt: quote.expiresAt,
    });
    return createHmac('sha256', env.jwtSecret).update(payload).digest('hex');
  }

  private verifySignature(quote: StoredQuote): boolean {
    const expected = Buffer.from(this.sign(quote), 'hex');
    const actual = Buffer.from(quote.signature ?? '', 'hex');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }
}
