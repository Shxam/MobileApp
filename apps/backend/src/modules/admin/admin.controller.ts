import { Controller, Get, Post, Patch, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('admin')
export class AdminController {
  @Get('reports/summary')
  @HttpCode(HttpStatus.OK)
  getSummaryReport() {
    return {
      todayRevenue: 48500,
      todayOrderCount: 64,
      activeTurfUtilizationPercent: 87.5,
      activeStaffCount: 8,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('orders')
  @HttpCode(HttpStatus.OK)
  getAdminOrders(@Query('status') status?: string) {
    return [
      {
        id: 'ord_101',
        userId: 'usr_78910',
        dhabaId: 'dhaba_singarayakonda',
        items: [
          { menuItemId: 'menu_1', name: 'Biriyani (Boneless)', quantity: 2, price: 250 },
          { menuItemId: 'menu_2', name: 'Amritsari Kulhad Lassi', quantity: 2, price: 110 },
        ],
        totalAmount: 720,
        deliveryType: 'turf_bench',
        deliveryTarget: 'Pitch Side - Cage A Bench',
        status: status === 'active' ? 'placed' : 'delivered',
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: 'ord_102',
        userId: 'usr_98765',
        dhabaId: 'dhaba_singarayakonda',
        items: [
          { menuItemId: 'menu_3', name: 'Tandoori Seekh Kebab', quantity: 3, price: 320 },
        ],
        totalAmount: 960,
        deliveryType: 'home_delivery',
        deliveryTarget: 'Door 4-12 Main Road',
        status: 'preparing',
        createdAt: new Date(Date.now() - 600000).toISOString(),
      },
    ];
  }

  @Get('turf-slots')
  @HttpCode(HttpStatus.OK)
  getTurfSlots() {
    return [
      { id: 's1', pitchName: 'Stadium Box Pitch A', timeSlot: '6:00 - 7:00', price: 900, isBooked: false, category: 'Morning' },
      { id: 's2', pitchName: 'Stadium Box Pitch A', timeSlot: '7:00 - 8:00', price: 900, isBooked: true, category: 'Morning' },
      { id: 's3', pitchName: 'Stadium Box Pitch A', timeSlot: '6:00 - 7:00', price: 1200, isBooked: true, category: 'Prime Evening' },
      { id: 's4', pitchName: 'Stadium Box Pitch B', timeSlot: '8:00 - 9:00', price: 1300, isBooked: false, category: 'Night Floodlit' },
    ];
  }

  @Post('staff')
  @HttpCode(HttpStatus.CREATED)
  createStaffAccount(@Body() dto: { employeeId: string; pin: string; name: string; role: string }) {
    return {
      success: true,
      message: `Staff account ${dto.employeeId} created successfully.`,
      staff: { id: `usr_staff_${dto.employeeId.toLowerCase()}`, ...dto },
    };
  }
}
