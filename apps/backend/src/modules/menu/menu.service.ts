import { Injectable, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface MenuItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isVeg: boolean;
  rating: number;
}

const SEED_MENU_ITEMS: MenuItemData[] = [
  {
    id: 'menu_1',
    name: 'Stadium Special Dum Biryani',
    description: 'Hyderabadi spiced slow-cooked basmati rice with marinated tender pieces',
    price: 349,
    category: 'Biryani',
    image: 'https://cdn.ipldhaba.com/menu/biryani.jpg',
    isVeg: false,
    rating: 4.9,
  },
  {
    id: 'menu_2',
    name: 'Matchday Paneer Butter Masala',
    description: 'Fresh cottage cheese cubes in rich creamy tomato gravy',
    price: 279,
    category: 'Curries',
    image: 'https://cdn.ipldhaba.com/menu/paneer.jpg',
    isVeg: true,
    rating: 4.8,
  },
  {
    id: 'menu_3',
    name: 'Floodlit Tandoori Roti Basket',
    description: 'Assorted whole-wheat rotis cooked in clay oven with butter',
    price: 99,
    category: 'Breads',
    image: 'https://cdn.ipldhaba.com/menu/roti.jpg',
    isVeg: true,
    rating: 4.7,
  },
  {
    id: 'menu_4',
    name: 'Powerplay Mango Lassi Pitcher',
    description: 'Chilled Alphonso mango yogurt drink',
    price: 149,
    category: 'Beverages',
    image: 'https://cdn.ipldhaba.com/menu/lassi.jpg',
    isVeg: true,
    rating: 4.9,
  },
];

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);
  private menuStore: MenuItemData[] = [...SEED_MENU_ITEMS];

  constructor(@Inject(RedisService) private readonly redisService: RedisService) {}

  async getMenuItems(category?: string, search?: string): Promise<MenuItemData[]> {
    const cacheKey = `menu:cat:${category || 'all'}:q:${search || 'all'}`;

    // 1. Try Redis Cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.log(`⚡ Served Menu from Redis Cache [Key: ${cacheKey}]`);
      return JSON.parse(cached);
    }

    // 2. Fetch & Filter Data
    let results = this.menuStore;
    if (category) {
      results = results.filter((item) => item.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      results = results.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase()),
      );
    }

    // 3. Cache in Redis with 3600s (1h) TTL
    await this.redisService.set(cacheKey, JSON.stringify(results), 3600);
    return results;
  }

  async addMenuItem(item: Omit<MenuItemData, 'id' | 'rating'>): Promise<MenuItemData> {
    const newItem: MenuItemData = {
      ...item,
      id: `menu_${Date.now()}`,
      rating: 4.8,
    };
    this.menuStore.push(newItem);

    // Cache Invalidation
    await this.invalidateCache();
    return newItem;
  }

  private async invalidateCache() {
    this.logger.log('🧹 Invalidating Redis Menu Caches');
    // Clear known keys
    await this.redisService.del('menu:cat:all:q:all');
  }
}
