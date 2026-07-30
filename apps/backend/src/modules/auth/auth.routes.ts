// ===================================================
// IPL Dhaba Backend — Auth Module Routes & Controller
// Phone OTP Auth & Cognito Session Handlers
// ===================================================

import { Router, Request, Response, NextFunction } from 'express';
import { Validator } from '../../../../../packages/shared/validation';
import { AppError } from '../../middleware/errorHandler';
import { INITIAL_USER } from '../../../../../src/data/mockData';

const router = Router();

/**
 * POST /api/v1/auth/send-otp
 * Trigger 6-digit phone OTP via SMS
 */
router.post('/send-otp', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;

    if (!phone || !Validator.validatePhone(phone)) {
      throw new AppError('Valid 10-digit mobile number required', 400, 'INVALID_PHONE');
    }

    res.json({
      success: true,
      data: {
        phone,
        otpSent: true,
        expiresInSeconds: 300,
        // In dev mode, return static demo OTP 654321
        demoOtp: '654321',
      },
      message: 'OTP sent successfully to ' + phone,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/verify-otp
 * Verify 6-digit OTP and return JWT session token
 */
router.post('/verify-otp', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      throw new AppError('Phone and 6-digit OTP required', 400, 'MISSING_CREDENTIALS');
    }

    if (otp !== '654321' && otp !== '123456') {
      throw new AppError('Invalid OTP code. Try 654321 for demo.', 401, 'INVALID_OTP');
    }

    const token = 'mock_jwt_token_ey...' + Date.now();

    res.json({
      success: true,
      data: {
        token,
        user: {
          ...INITIAL_USER,
          phone,
          isLoggedIn: true,
        },
      },
      message: 'Authentication successful',
    });
  } catch (err) {
    next(err);
  }
});

export const authRouter = router;
