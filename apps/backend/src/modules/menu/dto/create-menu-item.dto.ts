import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Price arrives as paise, never rupees — a float rupee value cannot round-trip
 * through GST or Razorpay without drift.
 */
export class CreateMenuItemDto {
  @IsString()
  @MaxLength(120)
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameHi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  descriptionHi?: string;

  /** Capped at ₹1,00,000 so a typo cannot create an absurd line item. */
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  pricePaise!: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  prepTimeMinutes?: number;
}
