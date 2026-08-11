import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class CreateReviewDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  // `enableImplicitConversion` is off globally, so a JSON number still needs the
  // explicit transform to survive as one.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment!: string;
}

class ListReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  @Post()
  create(@Req() req: any, @Body() body: CreateReviewDto) {
    return this.reviews.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  listMine(@Req() req: any, @Query() query: ListReviewsDto) {
    return this.reviews.listMine(req.user.userId, query.limit ?? 25);
  }

  /** Public: the turf detail screen shows ratings before sign-in. */
  @Get('turf/:turfId')
  listForTurf(@Param('turfId', ParseUUIDPipe) turfId: string, @Query() query: ListReviewsDto) {
    return this.reviews.listForTurf(turfId, query.limit ?? 25);
  }
}

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
