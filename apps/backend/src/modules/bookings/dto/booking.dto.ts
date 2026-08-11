import { PaymentMethod } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @MaxLength(64)
  slotId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  addons?: string[];

  /**
   * Only `wallet` and `cod` are accepted. Turf bookings have no gateway
   * intent/verify pair, so `razorpay` is rejected in the service rather than
   * silently confirming an unpaid booking.
   */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class VerifyGatePassDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}
