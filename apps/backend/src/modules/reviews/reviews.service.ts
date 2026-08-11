import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Newest-first page size ceiling, matching the notifications feed. */
const MAX_PAGE_SIZE = 50;

/**
 * A review only counts once the thing being reviewed has actually happened.
 *
 * Without this an order could be rated the second it was placed, which is how
 * rating systems end up reflecting the checkout screen rather than the food.
 */
const REVIEWABLE_ORDER_STATUSES = ['delivered'] as const;
const REVIEWABLE_BOOKING_STATUSES = ['confirmed', 'completed'] as const;

export interface ReviewView {
  id: string;
  rating: number;
  comment: string;
  orderId: string | null;
  bookingId: string | null;
  createdAt: string;
}

/**
 * Customer ratings for a completed order or turf booking.
 *
 * The `Review` model existed in the schema from Phase 2 but nothing wrote to it,
 * so the app's review modal collected a rating and dropped it on the floor. Every
 * write here is scoped to the caller's own `userId`, checked against the target's
 * status, and limited to one review per target.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a review against exactly one order or one booking.
   *
   * Ownership is verified by including `userId` in the lookup rather than
   * comparing after the fetch, so a review aimed at someone else's order 404s
   * without confirming that the id exists.
   */
  async create(
    userId: string,
    input: { orderId?: string; bookingId?: string; rating: number; comment: string },
  ): Promise<ReviewView> {
    const { orderId, bookingId, rating, comment } = input;

    // Exactly one target. Both would make the row ambiguous; neither would make
    // it unattached to anything.
    if ((orderId && bookingId) || (!orderId && !bookingId)) {
      throw new BadRequestException('A review must reference either an order or a booking, not both.');
    }

    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId },
        select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (!REVIEWABLE_ORDER_STATUSES.includes(order.status as (typeof REVIEWABLE_ORDER_STATUSES)[number])) {
        throw new BadRequestException('You can review an order once it has been delivered.');
      }
    } else {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, userId },
        select: { id: true, status: true },
      });
      if (!booking) throw new NotFoundException('Booking not found.');
      if (
        !REVIEWABLE_BOOKING_STATUSES.includes(booking.status as (typeof REVIEWABLE_BOOKING_STATUSES)[number])
      ) {
        throw new BadRequestException('That booking cannot be reviewed.');
      }
    }

    const existing = await this.prisma.review.findFirst({
      where: { userId, ...(orderId ? { orderId } : { bookingId }) },
      select: { id: true },
    });
    if (existing) throw new ConflictException('You have already reviewed this.');

    const review = await this.prisma.review.create({
      data: {
        userId,
        orderId: orderId ?? null,
        bookingId: bookingId ?? null,
        rating,
        comment: comment.trim(),
      },
    });

    // A turf's headline rating is a running average kept on the turf row, so it
    // has to be recomputed here — nothing else derives it.
    if (bookingId) await this.recomputeTurfRating(bookingId);

    return toView(review);
  }

  /** The caller's own reviews, newest first. */
  async listMine(userId: string, limit: number): Promise<ReviewView[]> {
    const rows = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
    });
    return rows.map(toView);
  }

  /** Public reviews for one turf, used by the turf detail screen. */
  async listForTurf(turfId: string, limit: number): Promise<(ReviewView & { authorName: string })[]> {
    const rows = await this.prisma.review.findMany({
      where: { booking: { slot: { turfId } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), MAX_PAGE_SIZE),
      include: { user: { select: { name: true } } },
    });

    // `User.name` is nullable — a customer who signed in by OTP and never set a
    // name would otherwise render as an empty byline on a public review.
    return rows.map((r) => ({ ...toView(r), authorName: r.user.name?.trim() || 'IPL Dhaba fan' }));
  }

  /**
   * Recomputes a turf's average rating from its reviews.
   *
   * Done as an aggregate over the source rows rather than an incremental
   * `(old * n + new) / (n + 1)`, which drifts as soon as a review is deleted or
   * two land concurrently.
   */
  private async recomputeTurfRating(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { slot: { select: { turfId: true } } },
    });
    const turfId = booking?.slot?.turfId;
    if (!turfId) return;

    const stats = await this.prisma.review.aggregate({
      where: { booking: { slot: { turfId } } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    if (stats._count._all === 0 || stats._avg.rating === null) return;

    await this.prisma.turf.update({
      where: { id: turfId },
      data: {
        // One decimal is what the UI renders; storing more implies a precision
        // a handful of 1–5 integers does not have.
        rating: Math.round(stats._avg.rating * 10) / 10,
        reviewsCount: stats._count._all,
      },
    });
  }
}

function toView(r: {
  id: string;
  rating: number;
  comment: string;
  orderId: string | null;
  bookingId: string | null;
  createdAt: Date;
}): ReviewView {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    orderId: r.orderId,
    bookingId: r.bookingId,
    createdAt: r.createdAt.toISOString(),
  };
}
