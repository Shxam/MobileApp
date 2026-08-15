import { IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Placing an order.
 *
 * Note what is *absent*: no prices, no item names, no total. The server holds
 * the priced cart under `quoteId` and re-verifies it before charging.
 */
export class CreateOrderDto {
  @IsString()
  @MaxLength(64)
  quoteId!: string;

  @IsIn(['razorpay', 'cod', 'wallet'])
  paymentMethod!: 'razorpay' | 'cod' | 'wallet';

  @IsString()
  @MaxLength(200)
  deliveryTarget!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cookingInstructions?: string;

  /**
   * Makes a retried submission return the original order instead of creating a
   * second one. Supplied by the client, unique per attempt.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class UpdateOrderStatusDto {
  @IsIn([
    'accepted',
    'preparing',
    'ready_for_pickup',
    'assigned',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
    'delivery_failed',
  ])
  status!:
    | 'accepted'
    | 'preparing'
    | 'ready_for_pickup'
    | 'assigned'
    | 'picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
    | 'delivery_failed';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class DriverLocationDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class VerifyDeliveryOtpDto {
  @IsString()
  @MaxLength(10)
  otp!: string;
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(['active', 'history', 'needs_review', 'all'])
  scope?: 'active' | 'history' | 'needs_review' | 'all';

  @IsOptional()
  // Without this, a query string `limit=20` stays the string "20" and fails
  // `@IsInt()` — the global pipe has implicit conversion disabled. The same
  // `@Type` pattern is used by the notifications and wallet DTOs.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReviewOrderDto {
  @IsOptional()
  @IsIn(['dismiss', 'resolve'])
  action?: 'dismiss' | 'resolve';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
