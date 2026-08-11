import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * The two fields a customer may change about themselves.
 *
 * Deliberately narrow. `phone` is what the Firebase identity is keyed on and
 * cannot be edited here; `role`, `walletBalancePaise` and `fanPoints` are
 * server-owned, and a DTO that accepted them would let anyone with a session
 * promote themselves to `admin` or credit their own wallet.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  favoriteTeam?: string;
}
