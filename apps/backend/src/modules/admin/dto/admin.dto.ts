import { IsEnum, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * Creating a staff account.
 *
 * The role is validated against the Prisma enum rather than accepted as a free
 * string — the previous controller took `role: string` and echoed it straight
 * back, so a typo produced an account with a role nothing recognised.
 */
export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  employeeId!: string;

  @IsString()
  @MaxLength(80)
  @IsNotEmpty()
  name!: string;

  // E.164. Staff share the `users` table with customers, where phone is the
  // natural key.
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be in E.164 format, e.g. +919876543210.' })
  phone!: string;

  @IsEnum(Role)
  role!: Role;

  /** Bootstrap PIN. Hashed immediately; the employee must change it on first login. */
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'pin must be exactly six digits.' })
  pin!: string;
}

// The admin order list reuses `ListOrdersQueryDto` so its filtering and paging
// cannot drift from the customer- and kitchen-facing list.
export { ListOrdersQueryDto as ListAdminOrdersDto } from '../../orders/dto/order.dto';
