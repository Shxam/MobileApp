import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { WalletService } from '../wallet/wallet.service';
import { env } from '../../common/config/env';
import { TURF_ADDON_FEE_PAISE, TURF_GST_RATE, applyGst } from '../pricing/pricing.constants';

const SLOT_INCLUDE = { slot: { include: { turf: true } } } satisfies Prisma.BookingInclude;
type BookingWithSlot = Prisma.BookingGetPayload<{ include: typeof SLOT_INCLUDE }>;

/** Nobody books more than this many add-ons; the cap stops a padded request. */
const MAX_ADDONS = 10;

/**
 * Turf slot booking.
 *
 * Previously the slot inventory and every booking lived in two per-process
 * arrays, so with the deployment's 2–10 replicas each pod believed in a
 * different set of free slots and a booking made on one was invisible to the
 * rest. Both now live in Postgres, and the "atomic lock" — a read-then-write
 * with a window wide enough to double-book — is a conditional `updateMany` on
 * the slot row.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly wallet: WalletService,
  ) {}

  async getSlots(date?: string) {
    const where: Prisma.TurfSlotWhereInput = {};
    if (date) {
      const day = this.parseDate(date);
      where.startTime = { gte: day, lt: new Date(day.getTime() + 24 * 60 * 60_000) };
    } else {
      // Default to what is still bookable.
      where.startTime = { gte: new Date() };
    }

    const slots = await this.prisma.turfSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
      take: 200,
      include: { turf: true },
    });

    return slots.map((slot) => ({
      id: slot.id,
      turfId: slot.turfId,
      // The slot carries its own pitch name for standalone slots; the turf's
      // name wins when the slot belongs to one.
      pitchName: slot.turf?.name ?? slot.pitchName,
      pitchType: slot.turf?.pitchType ?? 'AstroTurf Box',
      category: slot.category,
      timeSlot: this.formatWindow(slot.startTime, slot.endTime),
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      pricePaise: slot.pricePaise,
      isFloodlit: slot.isFloodlit,
      isBooked: slot.isBooked,
    }));
  }

  /**
   * Books a slot and issues a signed gate pass.
   *
   * The slot claim is a conditional update inside the transaction, so two
   * customers tapping the same slot cannot both succeed: the second matches
   * zero rows and is told the slot is gone.
   */
  async createBooking(
    userId: string,
    slotId: string,
    addons: string[] = [],
    paymentMethod: PaymentMethod = PaymentMethod.wallet,
  ) {
    const secret = env.gatePassSecret;
    if (!secret) {
      throw new ServiceUnavailableException('Gate pass signing is not configured. Set GATE_PASS_SECRET.');
    }
    if (addons.length > MAX_ADDONS) throw new BadRequestException(`At most ${MAX_ADDONS} add-ons per booking.`);
    if (paymentMethod === PaymentMethod.razorpay) {
      // Turf bookings settle at the wallet or the gate; a gateway flow for them
      // would need its own intent/verify pair, which does not exist yet.
      throw new BadRequestException('Pay for turf bookings from your wallet, or choose pay-at-venue.');
    }

    const slot = await this.prisma.turfSlot.findUnique({ where: { id: slotId }, include: { turf: true } });
    if (!slot) throw new NotFoundException('Turf slot not found.');
    if (slot.isBooked) throw new ConflictException('That slot has already been booked.');
    if (slot.startTime.getTime() < Date.now()) throw new BadRequestException('That slot has already started.');

    const subtotalPaise = slot.pricePaise + addons.length * TURF_ADDON_FEE_PAISE;
    const gstAmountPaise = applyGst(subtotalPaise, TURF_GST_RATE);
    const totalAmountPaise = subtotalPaise + gstAmountPaise;
    const bookingNumber = `TRF-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    // The id is generated here rather than left to the database default, so the
    // gate pass can be signed over it before the insert. The previous version
    // wrote a placeholder token and then issued a second `booking.update` to
    // replace it — a wasted round trip inside the transaction, on a remote
    // database, holding the slot's row lock the whole time.
    const bookingId = randomUUID();
    const gatePassToken = this.signGatePass(bookingId, slotId, userId, secret);

    const booking = await this.prisma.$transaction(async (tx) => {
      // The claim. Zero rows means someone else got there first.
      const { count } = await tx.turfSlot.updateMany({
        where: { id: slotId, isBooked: false },
        data: { isBooked: true },
      });
      if (count === 0) throw new ConflictException('That slot has already been booked.');

      const created = await tx.booking.create({
        data: {
          id: bookingId,
          userId,
          slotId,
          bookingNumber,
          subtotalPaise,
          gstAmountPaise,
          totalAmountPaise,
          addons,
          status: BookingStatus.confirmed,
          paymentMethod,
          paymentStatus: paymentMethod === PaymentMethod.wallet ? PaymentStatus.paid : PaymentStatus.cod_pending,
          // Signed over the booking id — unguessable — rather than over
          // `Date.now()`, which the previous implementation used and which is
          // trivially forgeable.
          gatePassToken,
        },
        include: SLOT_INCLUDE,
      });

      if (paymentMethod === PaymentMethod.wallet) {
        // Throwing here rolls back the slot claim and the booking too, so an
        // under-funded wallet never leaves a slot stuck as booked.
        await this.wallet.debitWithin(tx, userId, totalAmountPaise, `Turf booking ${bookingNumber}`, created.id, 'booking');
      }

      return created;
    });

    await this.eventBus.publish('booking.created', { bookingId: booking.id, userId, slotId, bookingNumber });
    this.logger.log(`Slot ${slotId} booked by ${userId} as ${bookingNumber}.`);
    return this.serialize(booking);
  }

  /**
   * A user's own bookings.
   *
   * The old implementation filtered with `b.userId === userId || userId === 'all'`,
   * so anyone whose id was the literal string `'all'` read every user's
   * bookings. Staff scope is now decided by role, never by a magic id.
   */
  async getUserBookings(userId: string, role: Role | string = Role.customer) {
    const where: Prisma.BookingWhereInput = this.isStaff(role) ? {} : { userId };

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: SLOT_INCLUDE,
    });
    return bookings.map((booking) => this.serialize(booking));
  }

  async cancelBooking(userId: string, bookingId: string, role: Role | string = Role.customer) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found.');
    if (!this.isStaff(role) && booking.userId !== userId) {
      throw new ForbiddenException('That booking belongs to a different account.');
    }
    if (booking.status === BookingStatus.cancelled) {
      return { bookingId, status: booking.status, refundedPaise: 0 };
    }

    const refundedPaise = booking.paymentStatus === PaymentStatus.paid ? booking.totalAmountPaise : 0;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: BookingStatus.confirmed },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date(),
          ...(refundedPaise > 0 ? { paymentStatus: PaymentStatus.refunded } : {}),
        },
      });
      // Zero rows means a concurrent cancel or completion won; refunding anyway
      // would pay the customer twice.
      if (count === 0) throw new ConflictException('That booking was already updated. Please refresh.');

      // Release the slot so it can be sold again.
      await tx.turfSlot.updateMany({ where: { id: booking.slotId }, data: { isBooked: false } });

      if (refundedPaise > 0) {
        await this.wallet.creditWithin(
          tx,
          booking.userId,
          refundedPaise,
          `Refund for booking ${booking.bookingNumber}`,
          booking.id,
          'refund',
        );
      }
    });

    await this.eventBus.publish('booking.cancelled', { bookingId, userId: booking.userId, refundedPaise });
    return { bookingId, status: BookingStatus.cancelled, refundedPaise };
  }

  /** Verifies a gate pass at the gate. */
  async verifyGatePass(token: string) {
    const secret = env.gatePassSecret;
    if (!secret) throw new ServiceUnavailableException('Gate pass verification is not configured.');

    const booking = await this.prisma.booking.findFirst({ where: { gatePassToken: token }, include: SLOT_INCLUDE });
    if (!booking) return { valid: false as const, reason: 'Unknown gate pass.' };

    const expected = this.signGatePass(booking.id, booking.slotId, booking.userId, secret);
    if (!this.constantTimeEquals(expected, booking.gatePassToken)) {
      return { valid: false as const, reason: 'Gate pass signature is invalid.' };
    }
    if (booking.status === BookingStatus.cancelled) {
      return { valid: false as const, reason: 'This booking was cancelled.' };
    }
    if (booking.paymentStatus !== PaymentStatus.paid) {
      return { valid: false as const, reason: 'Payment is still due for this booking.' };
    }
    if (booking.usedAt) {
      return { valid: false as const, reason: `Already used at ${booking.usedAt.toISOString()}` };
    }

    const now = new Date();
    const { count } = await this.prisma.booking.updateMany({
      where: { id: booking.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) {
      const rechecked = await this.prisma.booking.findUnique({ where: { id: booking.id } });
      return {
        valid: false as const,
        reason: `Already used at ${(rechecked?.usedAt || now).toISOString()}`,
      };
    }

    return { valid: true as const, booking: this.serialize({ ...booking, usedAt: now }) };
  }

  private isStaff(role: Role | string): boolean {
    return role === Role.admin || role === Role.partner;
  }

  private signGatePass(bookingId: string, slotId: string, userId: string, secret: string): string {
    // The full 64-hex digest: the previous implementation truncated to 16 chars,
    // leaving only 64 bits of forgery resistance on a pass that grants entry.
    const signature = createHmac('sha256', secret).update(`${bookingId}:${slotId}:${userId}`).digest('hex');
    return `GATEPASS-${bookingId.slice(0, 8).toUpperCase()}-${signature.toUpperCase()}`;
  }

  /** Compares signatures without leaking their prefix through timing. */
  private constantTimeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  private serialize(booking: BookingWithSlot) {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      turfId: booking.slot.turfId,
      // "My bookings" prints the venue and the address on the pass. A standalone
      // slot has no turf row, so its own pitch name stands in and the address is
      // the dhaba itself rather than an empty line on a gate pass.
      turfName: booking.slot.turf?.name ?? booking.slot.pitchName,
      turfAddress: booking.slot.turf?.address ?? 'IPL Dhaba, Singarayakonda',
      slotId: booking.slotId,
      // The calendar day in IST — the day the customer booked, not the UTC day,
      // which for a 23:00 floodlit slot is tomorrow.
      date: this.formatDate(booking.slot.startTime),
      timeSlot: this.formatWindow(booking.slot.startTime, booking.slot.endTime),
      startTime: booking.slot.startTime.toISOString(),
      endTime: booking.slot.endTime.toISOString(),
      subtotalPaise: booking.subtotalPaise,
      gstAmountPaise: booking.gstAmountPaise,
      totalAmountPaise: booking.totalAmountPaise,
      addons: booking.addons,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      gatePassToken: booking.gatePassToken,
      createdAt: booking.createdAt.toISOString(),
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    };
  }

  private formatWindow(startTime: Date, endTime: Date): string {
    const time = (date: Date) =>
      date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    return `${time(startTime)} - ${time(endTime)}`;
  }

  /** `YYYY-MM-DD` in IST — the same key the slot picker sends back as `?date=`. */
  private formatDate(value: Date): string {
    return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  private parseDate(value: string): Date {
    // Slots are sold in IST regardless of where the caller is.
    const parsed = new Date(`${value}T00:00:00+05:30`);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Date must be YYYY-MM-DD.');
    return parsed;
  }
}
