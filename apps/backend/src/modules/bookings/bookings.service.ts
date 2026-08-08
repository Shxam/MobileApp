import { Injectable, ConflictException, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import CryptoJS from 'crypto-js';

export interface TurfSlotData {
  id: string;
  pitchName: string;
  timeSlot: string;
  price: number;
  isBooked: boolean;
  category: string;
}

const SEED_SLOTS: TurfSlotData[] = [
  { id: 'slot_101', pitchName: 'Stadium Box Pitch A', timeSlot: '6:00 - 7:00', price: 1200, isBooked: false, category: 'Floodlit Night' },
  { id: 'slot_102', pitchName: 'Stadium Box Pitch A', timeSlot: '7:00 - 8:00', price: 1500, isBooked: false, category: 'Floodlit Night' },
  { id: 'slot_103', pitchName: 'Stadium Box Pitch A', timeSlot: '8:00 - 9:00', price: 1500, isBooked: false, category: 'Floodlit Night' },
  { id: 'slot_104', pitchName: 'Stadium Box Pitch B', timeSlot: '9:00 - 10:00', price: 1200, isBooked: false, category: 'Late Night T10' },
];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private slotsStore: TurfSlotData[] = [...SEED_SLOTS];
  private bookingsStore: any[] = [];

  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  async getSlots(): Promise<TurfSlotData[]> {
    return this.slotsStore;
  }

  /**
   * Atomic Booking Confirmation with Redis Slot Locking & Gate Pass Generation
   */
  async createBooking(userId: string, slotId: string, addons: string[] = []): Promise<any> {
    const lockKey = `lock:slot:${slotId}`;

    // 1. Acquire Redis Distributed Lock (10s lock TTL)
    const existingLock = await this.redisService.get(lockKey);
    if (existingLock) {
      this.logger.warn(`Atomic Slot Lock Active: Slot ${slotId} is currently being booked by another user`);
      throw new ConflictException('Slot is currently locked by another user. Double-booking prevented!');
    }

    // Set atomic lock
    await this.redisService.set(lockKey, userId, 10);

    try {
      const slot = this.slotsStore.find((s) => s.id === slotId);
      if (!slot) {
        throw new ConflictException('Turf slot not found');
      }
      if (slot.isBooked) {
        throw new ConflictException('Slot has already been booked!');
      }

      // Mark slot as booked
      slot.isBooked = true;

      // 2. Generate Signed Gate Pass Token String
      const secret = process.env.GATE_PASS_SECRET || 'ipl-dhaba-gatepass-secret-2026';
      const rawPayload = `${userId}:${slotId}:${Date.now()}`;
      const signature = CryptoJS.HmacSHA256(rawPayload, secret).toString(CryptoJS.enc.Hex).substring(0, 16);
      const gatePassToken = `GATEPASS-${slotId.toUpperCase()}-${signature.toUpperCase()}`;

      const booking = {
        id: `bk_${Date.now()}`,
        userId,
        slotId,
        pitchName: slot.pitchName,
        timeSlot: slot.timeSlot,
        totalAmount: slot.price + (addons.length * 150),
        status: 'confirmed',
        gatePassToken,
        addons,
        createdAt: new Date().toISOString(),
      };

      this.bookingsStore.push(booking);
      this.logger.log(`✅ Turf Slot ${slotId} atomically booked by User ${userId}. GatePass: ${gatePassToken}`);

      return booking;
    } finally {
      // Release lock after transaction completion
      await this.redisService.del(lockKey);
    }
  }

  async getUserBookings(userId: string): Promise<any[]> {
    return this.bookingsStore.filter((b) => b.userId === userId || userId === 'all');
  }
}
