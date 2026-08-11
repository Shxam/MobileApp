import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BookingStatus, OrderStatus, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';

const PIN_SALT_ROUNDS = 10;

/** Orders that represent real revenue — anything unpaid or reversed is excluded. */
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.placed,
  OrderStatus.accepted,
  OrderStatus.preparing,
  OrderStatus.ready_for_pickup,
  OrderStatus.assigned,
  OrderStatus.picked_up,
  OrderStatus.out_for_delivery,
  OrderStatus.delivered,
];

/**
 * Admin reporting and staff administration.
 *
 * Every figure here was previously a hardcoded literal in the controller —
 * `todayRevenue: 48500`, a two-element array of invented orders, and a
 * `POST /admin/staff` that returned `success: true` without writing anything.
 * The dashboard therefore showed the same numbers whether the dhaba had taken
 * a hundred orders or none.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Today's trading summary, computed from the actual tables. */
  async getSummaryReport(dhabaId: string = env.defaultDhabaId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayOrders: Prisma.OrderWhereInput = {
      dhabaId,
      createdAt: { gte: startOfDay },
      status: { in: REVENUE_STATUSES },
    };

    const [revenue, orderCount, slotTotal, slotsBooked, activeStaff, pendingPayouts] = await Promise.all([
      this.prisma.order.aggregate({ where: todayOrders, _sum: { totalAmountPaise: true } }),
      this.prisma.order.count({ where: todayOrders }),
      this.prisma.turfSlot.count({ where: { startTime: { gte: startOfDay } } }),
      this.prisma.turfSlot.count({ where: { startTime: { gte: startOfDay }, isBooked: true } }),
      this.prisma.user.count({
        where: { dhabaId, role: { in: [Role.kitchen_staff, Role.delivery_partner, Role.partner, Role.admin] } },
      }),
      // Cash the drivers are still carrying.
      this.prisma.order.aggregate({
        where: { dhabaId, paymentMethod: 'cod', paymentStatus: PaymentStatus.cod_pending },
        _sum: { totalAmountPaise: true },
      }),
    ]);

    return {
      todayRevenuePaise: revenue._sum.totalAmountPaise ?? 0,
      todayOrderCount: orderCount,
      // Guarded: an empty slot table is 0% utilisation, not a division by zero.
      turfUtilizationPercent: slotTotal === 0 ? 0 : Math.round((slotsBooked / slotTotal) * 1000) / 10,
      turfSlotsBooked: slotsBooked,
      turfSlotsTotal: slotTotal,
      activeStaffCount: activeStaff,
      codOutstandingPaise: pendingPayouts._sum.totalAmountPaise ?? 0,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Slot inventory with its live booking state. */
  async getTurfSlots(dhabaId: string = env.defaultDhabaId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const slots = await this.prisma.turfSlot.findMany({
      where: { startTime: { gte: startOfDay } },
      orderBy: { startTime: 'asc' },
      take: 200,
      include: {
        turf: true,
        bookings: {
          where: { status: BookingStatus.confirmed },
          select: { id: true, bookingNumber: true, userId: true },
          take: 1,
        },
      },
    });

    return slots.map((slot) => ({
      id: slot.id,
      pitchName: slot.turf?.name ?? slot.pitchName,
      category: slot.category,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      pricePaise: slot.pricePaise,
      isBooked: slot.isBooked,
      isFloodlit: slot.isFloodlit,
      booking: slot.bookings[0] ?? null,
      dhabaId,
    }));
  }

  /**
   * Creates a staff account and its bcrypt credential in one transaction.
   *
   * The PIN is hashed before it is stored and is never echoed back — the admin
   * who issues it is expected to hand it over out of band, and the employee
   * must change it on first login (`mustChangePin`).
   */
  async createStaffAccount(input: { employeeId: string; pin: string; name: string; role: Role; phone: string }) {
    const employeeId = input.employeeId.trim().toUpperCase();

    if (input.role === Role.customer) {
      throw new BadRequestException('Staff accounts cannot be created with the customer role.');
    }

    const clash = await this.prisma.staffCredential.findUnique({ where: { employeeId } });
    if (clash) {
      throw new ConflictException(`Employee ID ${employeeId} is already in use.`);
    }

    const pinHash = await bcrypt.hash(input.pin, PIN_SALT_ROUNDS);

    const staff = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { phone: input.phone },
        update: { role: input.role, employeeId, name: input.name.trim(), dhabaId: env.defaultDhabaId },
        create: {
          phone: input.phone,
          name: input.name.trim(),
          role: input.role,
          employeeId,
          dhabaId: env.defaultDhabaId,
        },
      });

      await tx.staffCredential.create({
        data: { userId: user.id, employeeId, pinHash, mustChangePin: true },
      });

      return user;
    });

    this.logger.log(`Staff account ${employeeId} (${input.role}) created.`);
    return {
      id: staff.id,
      employeeId,
      name: staff.name,
      role: staff.role,
      phone: staff.phone,
      dhabaId: staff.dhabaId,
      mustChangePin: true,
      createdAt: staff.createdAt.toISOString(),
    };
  }

  /** Staff roster with credential state — never the hash itself. */
  async listStaff(dhabaId: string = env.defaultDhabaId) {
    const staff = await this.prisma.user.findMany({
      where: { dhabaId, role: { in: [Role.kitchen_staff, Role.delivery_partner, Role.partner, Role.admin] } },
      orderBy: { createdAt: 'asc' },
      include: {
        staffCredential: {
          select: { employeeId: true, failedAttempts: true, lockedUntil: true, lastLoginAt: true, mustChangePin: true },
        },
      },
    });

    return staff.map((user) => ({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      employeeId: user.staffCredential?.employeeId ?? user.employeeId,
      mustChangePin: user.staffCredential?.mustChangePin ?? null,
      failedAttempts: user.staffCredential?.failedAttempts ?? 0,
      isLocked: Boolean(user.staffCredential?.lockedUntil && user.staffCredential.lockedUntil > new Date()),
      lastLoginAt: user.staffCredential?.lastLoginAt?.toISOString() ?? null,
    }));
  }

  /** Clears a lockout after the employee has been identified out of band. */
  async unlockStaff(employeeId: string) {
    const normalized = employeeId.trim().toUpperCase();
    const { count } = await this.prisma.staffCredential.updateMany({
      where: { employeeId: normalized },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    if (count === 0) throw new BadRequestException(`No staff credential for ${normalized}.`);
    this.logger.log(`Staff ${normalized} unlocked by an admin.`);
    return { employeeId: normalized, unlocked: true };
  }
}
