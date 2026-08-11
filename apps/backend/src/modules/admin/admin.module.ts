import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Module, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateStaffDto, ListAdminOrdersDto } from './dto/admin.dto';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Back-office endpoints.
 *
 * The guards are declared at the class level, so a route added here cannot be
 * left unprotected by omission. Previously this controller carried no guard at
 * all: `POST /admin/staff` was reachable by anyone on the internet, and the
 * reports leaked order and customer ids without authentication.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'partner')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  @Get('reports/summary')
  @HttpCode(HttpStatus.OK)
  getSummaryReport() {
    return this.admin.getSummaryReport();
  }

  /**
   * Delegates to `OrdersService`, which already applies role scoping and the
   * same serialisation customers and kitchen staff see — so the admin view
   * cannot drift from reality.
   */
  @Get('orders')
  @HttpCode(HttpStatus.OK)
  getAdminOrders(@Req() req: any, @Query() query: ListAdminOrdersDto) {
    return this.orders.listOrders(req.user, query);
  }

  @Get('turf-slots')
  @HttpCode(HttpStatus.OK)
  getTurfSlots() {
    return this.admin.getTurfSlots();
  }

  @Get('staff')
  @HttpCode(HttpStatus.OK)
  listStaff() {
    return this.admin.listStaff();
  }

  /** Creating staff is admin-only — a partner cannot mint an admin account. */
  @Post('staff')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  createStaffAccount(@Body() dto: CreateStaffDto) {
    return this.admin.createStaffAccount(dto);
  }

  @Post('staff/:employeeId/unlock')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  unlockStaff(@Param('employeeId') employeeId: string) {
    return this.admin.unlockStaff(employeeId);
  }
}

@Module({
  imports: [OrdersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
