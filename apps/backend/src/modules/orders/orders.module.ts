import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  HttpCode,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QuoteRequestDto } from '../pricing/dto/quote-request.dto';
import {
  CancelOrderDto,
  CreateOrderDto,
  DriverLocationDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  /**
   * Prices a cart and returns a short-lived quote id. Nothing is reserved and
   * no money moves — this is what the cart screen shows.
   */
  @Post('quote')
  @HttpCode(200)
  quote(@Req() req: any, @Body() body: QuoteRequestDto) {
    return this.ordersService.quote(
      req.user.userId,
      body.items,
      body.deliveryType ?? 'turf_bench',
      body.promoCode,
    );
  }

  /**
   * The interceptor replays a retried submission from cache; the unique
   * `Order.idempotencyKey` column is the guarantee that holds even without Redis.
   */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  createOrder(@Req() req: any, @Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(req.user, body);
  }

  @Get()
  listOrders(@Req() req: any, @Query() query: ListOrdersQueryDto) {
    return this.ordersService.listOrders(req.user, query);
  }

  @Get(':id')
  @HttpCode(200)
  getOrder(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.getOrder(req.user, id);
  }

  @Patch(':id/status')
  @HttpCode(200)
  @Roles('kitchen_staff', 'partner', 'admin', 'delivery_partner')
  updateOrderStatus(@Req() req: any, @Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(req.user, id, body.status, body.reason);
  }

  /** A customer withdrawing their own order; staff use `PATCH :id/status`. */
  @Patch(':id/cancel')
  @HttpCode(200)
  cancelOrder(@Req() req: any, @Param('id') id: string, @Body() body: CancelOrderDto) {
    return this.ordersService.cancelOrder(req.user, id, body.reason);
  }

  @Patch(':id/location')
  @Roles('delivery_partner')
  updateDriverLocation(@Req() req: any, @Param('id') id: string, @Body() body: DriverLocationDto) {
    return this.ordersService.updateDriverLocation(req.user, id, body);
  }
}

/**
 * The SSE `:id/tracking-stream` endpoint is gone. It sat behind `JwtAuthGuard`,
 * which a browser `EventSource` can never satisfy — it cannot send an
 * Authorization header — so tracking silently fell back to a fake animation.
 * Live tracking is socket.io only (Phase 7).
 */
@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
