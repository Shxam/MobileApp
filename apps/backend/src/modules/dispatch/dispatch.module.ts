import { Body, Controller, Get, Inject, Module, Param, Patch, Post, HttpCode, Req, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchSweepService } from './dispatch-sweep.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClaimOrderDto, CompleteDeliveryDto, ReleaseOrderDto, ReportIssueDto, SetOnlineDto } from './dto/dispatch.dto';

/**
 * Everything here is delivery-partner-only, enforced at the class level so a new
 * route cannot be added without a guard.
 */
@Controller('dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
export class DispatchController {
  constructor(@Inject(DispatchService) private readonly dispatch: DispatchService) {}

  @Get('status')
  getStatus(@Req() req: any) {
    return this.dispatch.getStatus(req.user.userId);
  }

  @Patch('status')
  @HttpCode(200)
  setOnline(@Req() req: any, @Body() body: SetOnlineDto) {
    return this.dispatch.setOnline(req.user.userId, body.isOnline);
  }

  /** The offer pool: ready orders no driver has claimed yet. */
  @Get('available')
  availableOrders(@Req() req: any) {
    return this.dispatch.availableOrders(req.user.userId);
  }

  @Get('current')
  currentDelivery(@Req() req: any) {
    return this.dispatch.currentDelivery(req.user.userId);
  }

  @Post('claim')
  @HttpCode(200)
  claimOrder(@Req() req: any, @Body() body: ClaimOrderDto) {
    return this.dispatch.claimOrder(req.user.userId, body.orderId);
  }

  @Post(':orderId/pickup')
  @HttpCode(200)
  markPickedUp(@Req() req: any, @Param('orderId') orderId: string) {
    return this.dispatch.markPickedUp(req.user.userId, orderId);
  }

  /** Closes the delivery against the customer's six-digit code. */
  @Post(':orderId/deliver')
  @HttpCode(200)
  completeDelivery(@Req() req: any, @Param('orderId') orderId: string, @Body() body: CompleteDeliveryDto) {
    return this.dispatch.completeDelivery(req.user.userId, orderId, body.otp);
  }

  @Post(':orderId/release')
  @HttpCode(200)
  releaseOrder(@Req() req: any, @Param('orderId') orderId: string, @Body() body: ReleaseOrderDto) {
    return this.dispatch.releaseOrder(req.user.userId, orderId, body.reason);
  }

  @Post(':orderId/issue')
  @HttpCode(200)
  reportIssue(@Req() req: any, @Param('orderId') orderId: string, @Body() body: ReportIssueDto) {
    return this.dispatch.reportIssue(req.user.userId, orderId, body.reason);
  }
}

@Module({
  controllers: [DispatchController],
  providers: [DispatchService, DispatchSweepService],
  exports: [DispatchService],
})
export class DispatchModule {}
