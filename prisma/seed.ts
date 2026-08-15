import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { SEED_MENU_ITEMS } from './seed-data/menu';

const hashPassword = async (pwd: string, saltRounds = 10): Promise<string> => {
  const fn = typeof bcrypt?.hash === 'function' ? bcrypt.hash : (bcrypt as any)?.default?.hash;
  if (typeof fn === 'function') {
    return fn(pwd, saltRounds);
  }
  // Fallback if bcrypt module format varies under ts-node / ESM
  return bcrypt.hash(pwd, saltRounds);
};

/**
 * Seeds a database with the reference dhaba's menu, turf, packages and vouchers.
 *
 * Exported rather than run at import time so the Jest global setup can seed the
 * isolated test schema by calling it directly — no `ts-node` dependency and no
 * risk of a stray import pointing a `PrismaClient` at the wrong database.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Seeding PostgreSQL...');

  const dhabaId = process.env.DEFAULT_DHABA_ID || 'dhaba_singarayakonda';

  // 1. Customer
  const user = await prisma.user.upsert({
    where: { phone: '+919876543210' },
    update: {},
    create: { phone: '+919876543210', name: 'IPL Dhaba Super Fan', role: Role.customer, dhabaId },
  });

  await prisma.fanPoints.upsert({
    where: { userId: user.id },
    update: { balance: 250 },
    create: { userId: user.id, balance: 250 },
  });
  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balancePaise: 0 },
  });

  // 2. Staff. The PIN comes from the environment and is bcrypt-hashed
  const seedPin = process.env.SEED_STAFF_PIN || process.env.STAFF_PIN || '7824';
  const kitchenEmpId = process.env.KITCHEN_EMPLOYEE_ID || 'KITCHEN-001';
  const deliveryEmpId = process.env.DELIVERY_EMPLOYEE_ID || 'DELIVERY-001';
  const adminEmpId = process.env.ADMIN_EMPLOYEE_ID || 'ADMIN-001';

  const staffAccounts: Array<{ phone: string; name: string; role: Role; employeeId: string }> = [
    { phone: '+919000000001', name: 'Kitchen Lead', role: Role.kitchen_staff, employeeId: kitchenEmpId },
    { phone: '+919000000011', name: 'Kitchen Lead Alias', role: Role.kitchen_staff, employeeId: 'KDS-001' },
    { phone: '+919000000002', name: 'Delivery Rider', role: Role.delivery_partner, employeeId: deliveryEmpId },
    { phone: '+919000000022', name: 'Delivery Rider Alias', role: Role.delivery_partner, employeeId: 'DRV-001' },
    { phone: '+919000000003', name: 'Dhaba Admin', role: Role.admin, employeeId: adminEmpId },
    { phone: '+919000000033', name: 'Dhaba Admin Alias', role: Role.admin, employeeId: 'ADM-001' },
  ];
  const pinHash = await hashPassword(seedPin, 10);
  for (const account of staffAccounts) {
    const staff = await prisma.user.upsert({
      where: { phone: account.phone },
      update: { role: account.role, employeeId: account.employeeId, dhabaId },
      create: { ...account, dhabaId },
    });
    await prisma.staffCredential.upsert({
      where: { userId: staff.id },
      update: { pinHash, employeeId: account.employeeId, failedAttempts: 0, lockedUntil: null },
      create: { userId: staff.id, employeeId: account.employeeId, pinHash, mustChangePin: false },
    });
  }
  console.log(`   • ${staffAccounts.length} staff accounts seeded with PIN.`);

  // 3. Menu — the dhaba's real card, from prisma/seed-data/menu.ts.
  const existingItems = await prisma.menuItem.findMany({ select: { name: true } });
  const existingNames = new Set(existingItems.map((item) => item.name));
  const toCreate = SEED_MENU_ITEMS.filter((item) => !existingNames.has(item.name)).map((item) => ({
    name: item.name,
    nameHi: item.nameHi,
    description: item.description,
    descriptionHi: item.descriptionHi,
    pricePaise: item.pricePaise,
    category: item.category,
    image: item.image,
    isVeg: item.isVeg,
    isAvailable: item.isAvailable,
    rating: item.rating,
    prepTimeMinutes: item.prepTimeMinutes,
    dhabaId,
  }));

  if (toCreate.length > 0) {
    await prisma.menuItem.createMany({ data: toCreate });
    console.log(`   • Inserted ${toCreate.length} menu items (${SEED_MENU_ITEMS.length - toCreate.length} already present).`);
  } else {
    console.log(`   • Menu up to date (${SEED_MENU_ITEMS.length} items present).`);
  }

  // 4. Turf & Slots
  const turf = await prisma.turf.upsert({
    where: { id: 'turf_singarayakonda' },
    update: { dhabaId },
    create: {
      id: 'turf_singarayakonda',
      name: 'IPL Dhaba Box Turf - Singarayakonda',
      location: 'NH-16, Singarayakonda, Prakasam Dist',
      area: 'Singarayakonda',
      address: 'NH-16, Singarayakonda, Prakasam Dist',
      pricePerHourPaise: 120000,
      pitchType: 'AstroTurf Box',
      rating: 4.9,
      reviewsCount: 512,
      isActive: true,
      dhabaId,
      amenities: ['Floodlights', 'Dressing Room', 'Cricket Gear', 'Live Dugout Snacks'],
    },
  });

  const slotsCount = await prisma.turfSlot.count({ where: { turfId: turf.id } });
  if (slotsCount === 0) {
    const slots = [];
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    for (let day = 0; day < 7; day++) {
      for (let hour = 16; hour < 22; hour++) {
        const start = new Date(baseDate);
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);

        const end = new Date(start);
        end.setHours(hour + 1, 0, 0, 0);

        slots.push({
          turfId: turf.id,
          pitchName: 'Stadium Box Turf A',
          startTime: start,
          endTime: end,
          pricePaise: hour >= 18 ? 150000 : 120000,
          category: hour >= 18 ? 'Floodlit Night' : 'Evening',
          isFloodlit: hour >= 18,
          isBooked: false,
        });
      }
    }
    await prisma.turfSlot.createMany({ data: slots });
    console.log(`   • Inserted ${slots.length} turf slots over 7 days.`);
  }

  // 5. Celebration Packages
  const packages = [
    {
      id: 'pkg_powerplay_party',
      title: 'Powerplay Birthday Bash',
      titleHi: 'पावरप्ले जन्मदिन पार्टी',
      subtitle: 'Ideal for 15-20 Fans • Turf Pitch Match + Food Combo',
      basePricePaise: 499900,
      image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&q=80&w=800',
      inclusions: ['2 Hours Turf Pitch Reserved', 'Full Dugout Balloon Theme', '20x Amritsari Kulcha Combos'],
      inclusionsHi: ['2 घंटे टर्फ पिच रिजर्व', 'डगआउट गुब्बारा सजावट', '20 अमृतसरी कुलचा कॉम्बो'],
      recommendedFor: 'Birthdays & Small Fan Clubs',
      rating: 4.9,
      isActive: true,
      dhabaId,
    },
  ];

  for (const pkg of packages) {
    await prisma.celebrationPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }

  // 6. Vouchers
  const vouchers = [
    {
      code: 'IPLPOWERPLAY',
      description: '20% off food orders over ₹500',
      discountType: 'percent',
      discountValue: 20,
      maxDiscountPaise: 15000,
      minSubtotalPaise: 50000,
      perUserLimit: 3,
      isActive: true,
    },
    {
      code: 'WELCOME50',
      description: 'Flat ₹50 off your first order',
      discountType: 'flat',
      discountValue: 5000,
      minSubtotalPaise: 20000,
      perUserLimit: 1,
      isActive: true,
    },
  ];

  for (const v of vouchers) {
    await prisma.voucher.upsert({
      where: { code: v.code },
      update: v,
      create: v,
    });
  }

  console.log('✅ Seeding complete.');
}

// Support direct execution via `npx prisma db seed`
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void (async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await seedDatabase(prisma);
    } catch (e) {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
