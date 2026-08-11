import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MaxLength, ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '../pricing.constants';

/**
 * A cart line as the client is allowed to express it.
 *
 * Deliberately just an id and a quantity: no name, no price, no category. The
 * server looks everything else up. `forbidNonWhitelisted` on the global
 * ValidationPipe turns a stray `price` field into a 400 rather than ignoring it.
 */
export class QuoteLineDto {
  @IsString()
  @MaxLength(64)
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class QuoteRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CART_LINES)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  items!: QuoteLineDto[];

  @IsOptional()
  @IsIn(['turf_slot', 'turf_bench', 'home_delivery'])
  deliveryType?: 'turf_slot' | 'turf_bench' | 'home_delivery';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  promoCode?: string;
}
