// ===================================================
// IPL Dhaba Backend — Bookings Module Routes & Controller
// Box Turf Reservations, Slot Holding & QR Pass Generation
// ===================================================

import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/security';
import { requireAuth } from '../../middleware/auth';
import { Validator } from '../../../../../packages/shared/validation';
import { TurfBooking } from '../../../../../packages/shared/types';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
const BOOKINGS_DB = new Map<string, TurfBooking>();

/**
 * GET /api/v1/bookings
 * Get user turf bookings
 */
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const userBookings = Array.from(BOOKINGS_DB.values()).filter((b) => b.userId === user.id);

    res.json({
      success: true,
      data: userBookings,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/bookings
 * Create new box turf booking
 */
router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const bookingData: Partial<TurfBooking> = req.body;

    const validation = Validator.validateTurfBooking(bookingData);
    if (!validation.valid) {
      throw new AppError('Turf booking validation failed', 400, 'INVALID_BOOKING_PAYLOAD', {
        validationErrors: validation.errors,
      });
    }

    const newBooking: TurfBooking = {
      id: `tb_${Math.floor(100000 + Math.random() * 900000)}`,
      turfId: bookingData.turfId || 'turf_singarayakonda',
      turfName: bookingData.turfName || 'IPL Dhaba Box Turf - Singarayakonda',
      turfAddress: bookingData.turfAddress || 'NH-16 Bypass Road, Singarayakonda',
      date: bookingData.date || new Date().toISOString().split('T')[0],
      slots: bookingData.slots || [],
      totalAmount: bookingData.totalAmount || 1200,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      qrCode: `QR-TURF-SINGARAYAKONDA-${Date.now()}`,
      addons: bookingData.addons || [],
      matchFormat: bookingData.matchFormat || 'Box Cricket T10',
      userId: user.id,
    };

    BOOKINGS_DB.set(newBooking.id, newBooking);

    res.status(201).json({
      success: true,
      data: newBooking,
      message: 'Turf slot successfully reserved!',
    });
  } catch (err) {
    next(err);
  }
});

export const bookingsRouter = router;
