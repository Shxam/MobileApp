import { Controller, Get, Module, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TurfsService } from './turfs.service';

class ListTurfsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/**
 * Read-only turf catalogue.
 *
 * Public, like `GET /menu`: the browse screen renders before anyone signs in.
 * Availability and booking live in `BookingsModule` (`/bookings/slots`), so
 * this module never writes.
 */
@Controller('turfs')
export class TurfsController {
  constructor(private readonly turfs: TurfsService) {}

  @Get()
  list(@Query() query: ListTurfsQueryDto) {
    return this.turfs.list(query.q);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.turfs.getById(id);
  }
}

@Module({
  controllers: [TurfsController],
  providers: [TurfsService],
  exports: [TurfsService],
})
export class TurfsModule {}
