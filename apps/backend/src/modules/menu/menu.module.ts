import { Module, Controller, Get, Post, Query, Body, Inject } from '@nestjs/common';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(@Inject(MenuService) private readonly menuService: MenuService) {}

  @Get()
  getMenuItems(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.menuService.getMenuItems(category, search);
  }

  @Post()
  addMenuItem(@Body() body: any) {
    return this.menuService.addMenuItem(body);
  }
}

@Module({
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
