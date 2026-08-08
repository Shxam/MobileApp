import { IsNotEmpty, IsString } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @IsNotEmpty()
  pin!: string;
}
