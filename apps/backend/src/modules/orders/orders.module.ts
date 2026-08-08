import { Module, Controller, Get, Post, Patch, HttpCode, Param, Body, Sse, Req, UseGuards, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Observable, map } from 'rxjs';

@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrder(@Req() req: any, @Body() body: any) {
    return this.ordersService.createOrder(req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listOrders(@Req() req: any) {
    return this.ordersService.listOrders(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @HttpCode(200)
  getOrder(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.getOrder(req.user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @HttpCode(200)
  updateOrderStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: any }) {
    return this.ordersService.updateStatus(req.user, id, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/location')
  updateDriverLocation(@Req() req: any, @Param('id') id: string, @Body() body: { latitude: number; longitude: number; heading?: number }) {
    return this.ordersService.updateDriverLocation(req.user, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Sse(':id/tracking-stream')
  streamOrderStatus(@Req() req: any, @Param('id') id: string): Observable<MessageEvent> {
    return this.ordersService.trackingStream(req.user, id).pipe(map((data) => ({ data } as MessageEvent)));
  }
}

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
