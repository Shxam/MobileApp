import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SetOnlineDto {
  @IsBoolean()
  isOnline!: boolean;
}

export class ClaimOrderDto {
  @IsString()
  @MaxLength(64)
  orderId!: string;
}

export class CompleteDeliveryDto {
  /** Exactly six digits — the code the customer reads out at the door. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The delivery code is six digits.' })
  otp!: string;
}

export class ReleaseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ReportIssueDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}
