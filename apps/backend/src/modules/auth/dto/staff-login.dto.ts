import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;
}

/** A staff member replacing their own PIN. */
export class ChangeStaffPinDto {
  @IsString()
  @IsNotEmpty()
  currentPin!: string;

  // Six digits, enforced here so the rule lives with the shape rather than in
  // the service. bcrypt will hash anything, including a one-character PIN.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'newPin must be exactly six digits.' })
  newPin!: string;
}
