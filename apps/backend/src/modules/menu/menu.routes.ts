// ===================================================
// IPL Dhaba Backend — Menu Module Controller & Routes
// Food Menu Browsing, Category Filtering, and Admin Management
// ===================================================

import { Router, Request, Response, NextFunction } from 'express';
import { MOCK_MENU, FOOD_CATEGORIES } from '../../../../../src/data/mockData';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/v1/menu
 * List menu items with category filtering and search
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = (req.query.category || 'all').toString();
    const search = (req.query.q || '').toString().toLowerCase();

    let items = MOCK_MENU;

    if (category !== 'all') {
      items = items.filter((item) => item.category === category);
    }

    if (search) {
      items = items.filter(
        (item) =>
          item.nameEn.toLowerCase().includes(search) ||
          item.nameHi.toLowerCase().includes(search) ||
          item.descriptionEn.toLowerCase().includes(search)
      );
    }

    res.json({
      success: true,
      data: items,
      meta: {
        total: items.length,
        category,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/menu/categories
 * List all food categories
 */
router.get('/categories', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: FOOD_CATEGORIES,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/menu
 * Create new menu item (Partner / Admin only)
 */
router.post('/', requireAuth, requireRole('partner', 'admin'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const newItem = {
      id: `m_${Date.now()}`,
      ...req.body,
    };

    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Menu item created successfully and pending admin approval',
    });
  } catch (err) {
    next(err);
  }
});

export const menuRouter = router;
