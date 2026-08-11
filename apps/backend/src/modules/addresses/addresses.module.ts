import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  // A rider needs more than "my house"; the same floor is enforced in the UI.
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  detail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(400)
  detail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pincode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Saved addresses are private by definition, so every route here is behind the
 * JWT guard and acts only on `req.user.userId` — there is deliberately no route
 * that takes a user id from the caller.
 */
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@Req() req: any) {
    return this.addresses.list(req.user.userId);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateAddressDto) {
    return this.addresses.create(req.user.userId, body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAddressDto) {
    return this.addresses.update(req.user.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.addresses.remove(req.user.userId, id);
  }
}

@Module({
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
