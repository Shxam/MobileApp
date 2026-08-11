import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BookingStatus,
  CelebrationPackage,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { WalletService } from '../wallet/wallet.service';
import { env } from '../../common/config/env';
import {
  CELEBRATION_CAKE_PER_KG_PAISE,
  CELEBRATION_COMMENTARY_PAISE,
  CELEBRATION_EXTRA_GUEST_PAISE,
  CELEBRATION_FOOD_MENU_PAISE,
  CELEBRATION_INCLUDED_GUESTS,
  CELEBRATION_MAX_CAKE_KG,
  CELEBRATION_MAX_GUESTS,
  CELEBRATION_MIN_GUESTS,
  CELEBRATION_TROPHY_PAISE,
  TURF_GST_RATE,
  applyGst,
} from '../pricing/pricing.constants';
import type { CreateCelebrationBookingDto } from './dto/celebration.dto';

const BOOKING_INCLUDE = { package: true } satisfies Prisma.CelebrationBookingInclude;
type BookingWithPackage = Prisma.CelebrationBookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

/** Package as the customer app consumes it. Mirrors `packages/types`. */
export interface CelebrationPackageData {
  id: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  basePricePaise: number;
  image: string;
  inclusionsEn: string[];
  inclusionsHi: string[];
  recommendedFor: string;
  rating: number;
  isActive: boolean;
}

/** The priced breakdown, returned by the quote endpoint and by every booking. */
export interface CelebrationQuote {
  basePricePaise: number;
  extraGuestPaise: number;
  commentaryPaise: number;
  trophyPaise: number;
  foodMenuPaise: number;
  cakePaise: number;
  addonsPaise: number;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
}

/**
 * Celebration packages and party bookings.
 *
 * Both halves used to live in the browser: the package list was
 * `MOCK_CELEBRATION_PACKAGES`, and `CelebrationsView.calculateTotal` added up
 * the add-ons client-side before `AppContext` invented a booking id and wrote it
 * to localStorage. Nothing reached the dhaba. The catalogue now comes from the
 * `celebration_packages` table, the price is computed here from
 * `pricing.constants`, and the booking is a row.
 */
@Injectable()
export class CelebrationsService {
  private readonly logger = new Logger(CelebrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly wallet: WalletService,
  ) {}

  async listPackages(): Promise<CelebrationPackageData[]> {
    const packages = await this.prisma.celebrationPackage.findMany({
      where: { dhabaId: env.defaultDhabaId, isActive: true },
      orderBy: [{ basePricePaise: 'asc' }, { title: 'asc' }],
    });
    return packages.map((pkg) => this.serializePackage(pkg));
  }

  /**
   * Prices a party without booking it, so the customisation drawer can show a
   * running total that is guaranteed to match what the booking will charge.
   */
  async quote(input: CreateCelebrationBookingDto): Promise<CelebrationQuote> {
    const pkg = await this.requirePackage(input.packageId);
    return this.price(pkg, input);
  }

  async createBooking(userId: string, input: CreateCelebrationBookingDto): Promise<ReturnType<CelebrationsService['serializeBooking']>> {
    const pkg = await this.requirePackage(input.packageId);
    const eventDate = this.parseEventDate(input.eventDate);
    const quote = this.price(pkg, input);
    const bookingNumber = `CEL-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    const paymentMethod = input.paymentMethod ?? PaymentMethod.wallet;
    if (paymentMethod === PaymentMethod.razorpay) {
      // Same reasoning as turf bookings: a gateway flow needs its own
      // intent/verify pair against this table, which does not exist yet.
      throw new BadRequestException('Pay for celebrations from your wallet, or choose pay-at-venue.');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.celebrationBooking.create({
        data: {
          bookingNumber,
          userId,
          packageId: pkg.id,
          eventDate,
          timeSlot: input.timeSlot,
          guestCount: input.guestCount,
          turfName: input.turfName ?? '',
          decorTheme: input.decorTheme ?? '',
          commentarySetup: input.commentarySetup ?? false,
          trophyPackage: input.trophyPackage ?? false,
          specialFoodMenu: input.specialFoodMenu ?? false,
          cakeKg: input.cakeKg ?? 0,
          basePricePaise: quote.basePricePaise,
          addonsPaise: quote.addonsPaise,
          subtotalPaise: quote.subtotalPaise,
          gstAmountPaise: quote.gstAmountPaise,
          totalAmountPaise: quote.totalAmountPaise,
          status: BookingStatus.confirmed,
          paymentMethod,
          paymentStatus: paymentMethod === PaymentMethod.wallet ? PaymentStatus.paid : PaymentStatus.cod_pending,
        },
        include: BOOKING_INCLUDE,
      });

      if (paymentMethod === PaymentMethod.wallet) {
        // Throwing rolls the booking back too, so an under-funded wallet never
        // leaves a confirmed party nobody paid for.
        await this.wallet.debitWithin(
          tx,
          userId,
          quote.totalAmountPaise,
          `Celebration ${bookingNumber}`,
          created.id,
          'celebration',
        );
      }

      return created;
    });

    await this.eventBus.publish('celebration.booked', {
      bookingId: booking.id,
      userId,
      bookingNumber,
      totalAmountPaise: quote.totalAmountPaise,
    });
    this.logger.log(`Celebration ${bookingNumber} booked by ${userId}.`);
    return this.serializeBooking(booking);
  }

  /** A user's own parties; staff see every booking. */
  async listBookings(userId: string, role: Role | string = Role.customer) {
    const where: Prisma.CelebrationBookingWhereInput = this.isStaff(role) ? {} : { userId };
    const bookings = await this.prisma.celebrationBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: BOOKING_INCLUDE,
    });
    return bookings.map((booking) => this.serializeBooking(booking));
  }

  async cancelBooking(userId: string, bookingId: string, role: Role | string = Role.customer) {
    const booking = await this.prisma.celebrationBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Celebration booking not found.');
    if (!this.isStaff(role) && booking.userId !== userId) {
      throw new ForbiddenException('That booking belongs to a different account.');
    }
    if (booking.status === BookingStatus.cancelled) {
      return { bookingId, status: booking.status, refundedPaise: 0 };
    }

    const refundedPaise = booking.paymentStatus === PaymentStatus.paid ? booking.totalAmountPaise : 0;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.celebrationBooking.updateMany({
        where: { id: bookingId, status: BookingStatus.confirmed },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date(),
          ...(refundedPaise > 0 ? { paymentStatus: PaymentStatus.refunded } : {}),
        },
      });
      // Zero rows means a concurrent cancel won; refunding anyway would pay the
      // customer twice.
      if (count === 0) throw new ConflictException('That booking was already updated. Please refresh.');

      if (refundedPaise > 0) {
        await this.wallet.creditWithin(
          tx,
          booking.userId,
          refundedPaise,
          `Refund for celebration ${booking.bookingNumber}`,
          booking.id,
          'refund',
        );
      }
    });

    await this.eventBus.publish('celebration.cancelled', { bookingId, userId: booking.userId, refundedPaise });
    return { bookingId, status: BookingStatus.cancelled, refundedPaise };
  }

  /**
   * The single pricing implementation, used by both the quote and the booking so
   * the two can never disagree.
   */
  private price(pkg: CelebrationPackage, input: CreateCelebrationBookingDto): CelebrationQuote {
    const guestCount = input.guestCount;
    const cakeKg = input.cakeKg ?? 0;

    const extraGuestPaise =
      Math.max(0, guestCount - CELEBRATION_INCLUDED_GUESTS) * CELEBRATION_EXTRA_GUEST_PAISE;
    const commentaryPaise = input.commentarySetup ? CELEBRATION_COMMENTARY_PAISE : 0;
    const trophyPaise = input.trophyPackage ? CELEBRATION_TROPHY_PAISE : 0;
    const foodMenuPaise = input.specialFoodMenu ? CELEBRATION_FOOD_MENU_PAISE : 0;
    const cakePaise = cakeKg * CELEBRATION_CAKE_PER_KG_PAISE;

    const addonsPaise = extraGuestPaise + commentaryPaise + trophyPaise + foodMenuPaise + cakePaise;
    const subtotalPaise = pkg.basePricePaise + addonsPaise;
    // A celebration is a venue service, so it carries the 18% turf rate rather
    // than the 5% food rate — even though food is part of the package.
    const gstAmountPaise = applyGst(subtotalPaise, TURF_GST_RATE);

    return {
      basePricePaise: pkg.basePricePaise,
      extraGuestPaise,
      commentaryPaise,
      trophyPaise,
      foodMenuPaise,
      cakePaise,
      addonsPaise,
      subtotalPaise,
      gstAmountPaise,
      totalAmountPaise: subtotalPaise + gstAmountPaise,
    };
  }

  private async requirePackage(packageId: string): Promise<CelebrationPackage> {
    const pkg = await this.prisma.celebrationPackage.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('That celebration package is no longer offered.');
    return pkg;
  }

  /**
   * Parses the event date and refuses one in the past.
   *
   * Parsed as IST midnight, matching how turf slots are sold, so a customer
   * booking from another timezone gets the day they picked rather than the day
   * before.
   */
  private parseEventDate(value: string): Date {
    const parsed = new Date(`${value}T00:00:00+05:30`);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Event date must be YYYY-MM-DD.');
    // Compared against the start of today, not against `now`: a party booked for
    // this evening is legitimate.
    const startOfToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00+05:30');
    if (parsed.getTime() < startOfToday.getTime()) {
      throw new BadRequestException('That event date has already passed.');
    }
    return parsed;
  }

  private isStaff(role: Role | string): boolean {
    return role === Role.admin || role === Role.partner;
  }

  private serializePackage(pkg: CelebrationPackage): CelebrationPackageData {
    return {
      id: pkg.id,
      titleEn: pkg.title,
      titleHi: pkg.titleHi ?? pkg.title,
      subtitleEn: pkg.subtitle,
      subtitleHi: pkg.subtitleHi ?? pkg.subtitle,
      basePricePaise: pkg.basePricePaise,
      image: pkg.image,
      inclusionsEn: pkg.inclusions,
      // Falls back to the English list rather than to an empty one: a Hindi
      // reader should see the inclusions untranslated, not see none.
      inclusionsHi: pkg.inclusionsHi.length > 0 ? pkg.inclusionsHi : pkg.inclusions,
      recommendedFor: pkg.recommendedFor,
      rating: pkg.rating,
      isActive: pkg.isActive,
    };
  }

  private serializeBooking(booking: BookingWithPackage) {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      packageId: booking.packageId,
      packageName: booking.package.title,
      turfName: booking.turfName,
      eventDate: booking.eventDate.toISOString().slice(0, 10),
      timeSlot: booking.timeSlot,
      guestCount: booking.guestCount,
      customizations: {
        decorTheme: booking.decorTheme,
        commentarySetup: booking.commentarySetup,
        trophyPackage: booking.trophyPackage,
        specialFoodMenu: booking.specialFoodMenu,
        cakeKg: booking.cakeKg,
      },
      basePricePaise: booking.basePricePaise,
      addonsPaise: booking.addonsPaise,
      subtotalPaise: booking.subtotalPaise,
      gstAmountPaise: booking.gstAmountPaise,
      totalAmountPaise: booking.totalAmountPaise,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt.toISOString(),
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    };
  }
}

// Re-exported so the bounds live next to the service that enforces them.
export { CELEBRATION_MAX_CAKE_KG, CELEBRATION_MAX_GUESTS, CELEBRATION_MIN_GUESTS };
