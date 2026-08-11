import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';

/** Menu item as returned to clients. Money is paise. */
export interface MenuItemData {
  id: string;
  nameEn: string;
  nameHi: string;
  descriptionEn: string;
  descriptionHi: string;
  pricePaise: number;
  category: string;
  image: string;
  isVeg: boolean;
  isAvailable: boolean;
  rating: number;
  prepTimeMinutes: number;
}

type MenuItemRow = {
  id: string;
  name: string;
  nameHi: string | null;
  description: string;
  descriptionHi: string | null;
  pricePaise: number;
  category: string;
  image: string;
  isVeg: boolean;
  isAvailable: boolean;
  rating: number;
  prepTimeMinutes: number;
};

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getMenuItems(category?: string, search?: string, includeUnavailable = false): Promise<MenuItemData[]> {
    const items = await this.prisma.menuItem.findMany({
      where: {
        dhabaId: env.defaultDhabaId,
        ...(includeUnavailable ? {} : { isAvailable: true }),
        ...(category && category !== 'all'
          ? { category: { equals: category, mode: 'insensitive' as const } }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return items.map((item) => this.serialize(item));
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.prisma.menuItem.findMany({
      where: { dhabaId: env.defaultDhabaId, isAvailable: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((row) => row.category);
  }

  async addMenuItem(item: CreateMenuItemDto): Promise<MenuItemData> {
    const name = item.nameEn.trim();
    if (!name) throw new BadRequestException('A menu item needs a name.');

    const created = await this.prisma.menuItem.create({
      data: {
        name,
        nameHi: item.nameHi?.trim() || null,
        description: item.descriptionEn?.trim() || name,
        descriptionHi: item.descriptionHi?.trim() || null,
        pricePaise: item.pricePaise,
        category: item.category?.trim() || 'Menu',
        image: item.image?.trim() || '',
        isVeg: item.isVeg ?? true,
        prepTimeMinutes: item.prepTimeMinutes ?? 15,
        dhabaId: env.defaultDhabaId,
      },
    });
    return this.serialize(created);
  }

  async updateMenuItem(id: string, patch: Partial<CreateMenuItemDto>): Promise<MenuItemData> {
    await this.requireItem(id);
    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(patch.nameEn !== undefined ? { name: patch.nameEn.trim() } : {}),
        ...(patch.nameHi !== undefined ? { nameHi: patch.nameHi.trim() || null } : {}),
        ...(patch.descriptionEn !== undefined ? { description: patch.descriptionEn.trim() } : {}),
        ...(patch.descriptionHi !== undefined ? { descriptionHi: patch.descriptionHi.trim() || null } : {}),
        ...(patch.pricePaise !== undefined ? { pricePaise: patch.pricePaise } : {}),
        ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
        ...(patch.image !== undefined ? { image: patch.image.trim() } : {}),
        ...(patch.isVeg !== undefined ? { isVeg: patch.isVeg } : {}),
        ...(patch.prepTimeMinutes !== undefined ? { prepTimeMinutes: patch.prepTimeMinutes } : {}),
      },
    });
    return this.serialize(updated);
  }

  async setAvailability(id: string, isAvailable: boolean): Promise<MenuItemData> {
    await this.requireItem(id);
    const updated = await this.prisma.menuItem.update({ where: { id }, data: { isAvailable } });
    return this.serialize(updated);
  }

  private async requireItem(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Menu item not found.');
    return item;
  }

  private serialize(item: MenuItemRow): MenuItemData {
    return {
      id: item.id,
      nameEn: item.name,
      nameHi: item.nameHi ?? item.name,
      descriptionEn: item.description,
      descriptionHi: item.descriptionHi ?? item.description,
      pricePaise: item.pricePaise,
      category: item.category,
      image: item.image,
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
      rating: item.rating,
      prepTimeMinutes: item.prepTimeMinutes,
    };
  }
}
