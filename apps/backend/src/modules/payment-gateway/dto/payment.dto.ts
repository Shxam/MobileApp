import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  @MaxLength(64)
  orderId!: string;
}

/** The three fields Razorpay Checkout hands back to the browser on success. */
export class VerifyPaymentDto {
  @IsString()
  @MaxLength(64)
  orderId!: string;

  @IsString()
  @MaxLength(120)
  razorpayOrderId!: string;

  @IsString()
  @MaxLength(120)
  razorpayPaymentId!: string;

  @IsString()
  @MaxLength(256)
  razorpaySignature!: string;
}

export class WalletTopUpIntentDto {
  /** Paise, not rupees. Bounded: ₹10 minimum, ₹50,000 maximum per top-up. */
  @IsInt()
  @Min(1000)
  @Max(5_000_000)
  amountPaise!: number;
}

/** The Checkout response for a top-up. No amount — the server already has it. */
export class VerifyWalletTopUpDto {
  @IsString()
  @MaxLength(120)
  razorpayOrderId!: string;

  @IsString()
  @MaxLength(120)
  razorpayPaymentId!: string;

  @IsString()
  @MaxLength(256)
  razorpaySignature!: string;
}
