import { Module, Controller, Get, Post, Patch, Query, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /** Public: the customer app reads the menu before anyone signs in. */
  @Get()
  getMenuItems(@Query('category') category?: string, @Query('search') search?: string) {
    return this.menuService.getMenuItems(category, search);
  }

  @Get('categories')
  getCategories() {
    return this.menuService.getCategories();
  }

  /** Staff view includes sold-out items so they can be switched back on. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'kitchen_staff', 'partner')
  @Get('manage')
  listForStaff(@Query('category') category?: string, @Query('search') search?: string) {
    return this.menuService.getMenuItems(category, search, true);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'partner')
  @Post()
  addMenuItem(@Body() body: CreateMenuItemDto) {
    return this.menuService.addMenuItem(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'partner')
  @Patch(':id')
  @HttpCode(200)
  updateMenuItem(@Param('id') id: string, @Body() body: UpdateMenuItemDto) {
    return this.menuService.updateMenuItem(id, body);
  }

  /** Kitchen staff toggle stock during service; they cannot change prices. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'partner', 'kitchen_staff')
  @Patch(':id/availability')
  @HttpCode(200)
  setAvailability(@Param('id') id: string, @Body() body: SetAvailabilityDto) {
    return this.menuService.setAvailability(id, body.isAvailable);
  }
}

@Module({
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
