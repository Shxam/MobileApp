import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Every field optional — a PATCH may carry only what changed. */
export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEn?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  pricePaise?: number;

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
