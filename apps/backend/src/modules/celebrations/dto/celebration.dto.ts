import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import {
  CELEBRATION_MAX_CAKE_KG,
  CELEBRATION_MAX_GUESTS,
  CELEBRATION_MIN_GUESTS,
} from '../../pricing/pricing.constants';

/**
 * Booking a party.
 *
 * Note what is absent: no prices. The client picks options; the server prices
 * them from `pricing.constants`. The previous flow computed the total in
 * `CelebrationsView.calculateTotal` and would have let the browser name its own
 * figure.
 */
export class CreateCelebrationBookingDto {
  @IsUUID()
  packageId!: string;

  /** IST calendar date, YYYY-MM-DD. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'eventDate must be YYYY-MM-DD.' })
  eventDate!: string;

  @IsString()
  @MaxLength(60)
  timeSlot!: string;

  @Type(() => Number)
  @IsInt()
  @Min(CELEBRATION_MIN_GUESTS)
  @Max(CELEBRATION_MAX_GUESTS)
  guestCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  turfName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  decorTheme?: string;

  @IsOptional()
  @IsBoolean()
  commentarySetup?: boolean;

  @IsOptional()
  @IsBoolean()
  trophyPackage?: boolean;

  @IsOptional()
  @IsBoolean()
  specialFoodMenu?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(CELEBRATION_MAX_CAKE_KG)
  cakeKg?: number;

  /** Razorpay is rejected by the service; wallet or pay-at-venue only. */
  @IsOptional()
  @IsIn([PaymentMethod.wallet, PaymentMethod.cod])
  paymentMethod?: PaymentMethod;
}
