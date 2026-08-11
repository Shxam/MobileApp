import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // 2. Staff. The PIN comes from the environment and is bcrypt-hashed — the
  // shared plaintext STAFF_PIN this replaced was readable by anyone with DB
  // access and identical for every employee.
  const seedPin = process.env.SEED_STAFF_PIN;
  if (seedPin) {
    const staffAccounts: Array<{ phone: string; name: string; role: Role; employeeId: string }> = [
      { phone: '+919000000001', name: 'Kitchen Lead', role: Role.kitchen_staff, employeeId: 'KDS-001' },
      { phone: '+919000000002', name: 'Delivery Rider', role: Role.delivery_partner, employeeId: 'DRV-001' },
      { phone: '+919000000003', name: 'Dhaba Admin', role: Role.admin, employeeId: 'ADM-001' },
    ];
    const pinHash = await bcrypt.hash(seedPin, 10);
    for (const account of staffAccounts) {
      const staff = await prisma.user.upsert({
        where: { phone: account.phone },
        update: { role: account.role, employeeId: account.employeeId, dhabaId },
        create: { ...account, dhabaId },
      });
      await prisma.staffCredential.upsert({
        where: { userId: staff.id },
        update: { pinHash, employeeId: account.employeeId },
        create: { userId: staff.id, employeeId: account.employeeId, pinHash, mustChangePin: true },
      });
    }
    console.log(`   • ${staffAccounts.length} staff accounts (PIN hashed from SEED_STAFF_PIN).`);
  } else {
    console.log('   • Skipping staff accounts: set SEED_STAFF_PIN to create them.');
  }

  // 3. Menu
  const menuItems = [
    {
      name: 'Stadium Special Dum Biryani',
      description: 'Hyderabadi spiced slow-cooked basmati rice with marinated tender pieces',
      pricePaise: 349_00,
      category: 'Biryani',
      image: 'https://cdn.ipldhaba.com/menu/biryani.jpg',
      isVeg: false,
      rating: 4.9,
    },
    {
      name: 'Matchday Paneer Butter Masala',
      description: 'Fresh cottage cheese cubes in rich creamy tomato gravy',
      pricePaise: 279_00,
      category: 'Curries',
      image: 'https://cdn.ipldhaba.com/menu/paneer.jpg',
      isVeg: true,
      rating: 4.8,
    },
    {
      name: 'Floodlit Tandoori Roti Basket',
      description: 'Assorted whole-wheat rotis cooked in clay oven with butter',
      pricePaise: 99_00,
      category: 'Breads',
      image: 'https://cdn.ipldhaba.com/menu/roti.jpg',
      isVeg: true,
      rating: 4.7,
    },
  ];

  for (const item of menuItems) {
    // Upsert on name so re-running the seed does not duplicate the menu.
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name, dhabaId } });
    if (existing) await prisma.menuItem.update({ where: { id: existing.id }, data: { ...item, dhabaId } });
    else await prisma.menuItem.create({ data: { ...item, dhabaId } });
  }

  // 4. Turf + slots
  const turfName = 'Stadium Box Turf';
  let turf = await prisma.turf.findFirst({ where: { name: turfName, dhabaId } });
  if (!turf) {
    turf = await prisma.turf.create({
      data: {
        name: turfName,
        location: 'Singarayakonda',
        area: 'NH-16 Service Road',
        address: 'IPL Dhaba, NH-16, Singarayakonda, Andhra Pradesh',
        pricePerHourPaise: 1200_00,
        pitchType: 'AstroTurf Box',
        amenities: ['Floodlights', 'Changing Room', 'Parking', 'Drinking Water'],
        description: 'Full-size floodlit box cricket turf next to the dhaba.',
        dhabaId,
      },
    });
  }

  const now = new Date();
  const slots = [
    { pitchName: 'Stadium Box Pitch A', offsetHours: 1, pricePaise: 1200_00, category: 'Floodlit Night', isFloodlit: true },
    { pitchName: 'Stadium Box Pitch B', offsetHours: 2, pricePaise: 1500_00, category: 'Late Night T10', isFloodlit: true },
  ];
  for (const slot of slots) {
    const startTime = new Date(now.getTime() + slot.offsetHours * 3600_000);
    const endTime = new Date(startTime.getTime() + 3600_000);
    const existing = await prisma.turfSlot.findFirst({ where: { turfId: turf.id, startTime } });
    if (!existing) {
      await prisma.turfSlot.create({
        data: {
          turfId: turf.id,
          pitchName: slot.pitchName,
          startTime,
          endTime,
          pricePaise: slot.pricePaise,
          category: slot.category,
          isFloodlit: slot.isFloodlit,
        },
      });
    }
  }

  // 5. Celebration packages — these were frontend mock constants.
  const packages = [
    {
      title: 'Match Day Birthday Bash',
      subtitle: 'Cake, decorations and a stadium-side table',
      basePricePaise: 4999_00,
      inclusions: ['1kg cake', 'Balloon decor', 'Reserved bench', 'Dedicated server'],
      recommendedFor: 'Birthdays',
    },
    {
      title: 'Team Victory Party',
      subtitle: 'Post-match feast for the whole squad',
      basePricePaise: 8999_00,
      inclusions: ['Unlimited biryani', 'Team banner', 'Trophy photo corner', 'Turf hour included'],
      recommendedFor: 'Teams of 12+',
    },
  ];
  for (const pkg of packages) {
    const existing = await prisma.celebrationPackage.findFirst({ where: { title: pkg.title, dhabaId } });
    if (existing) await prisma.celebrationPackage.update({ where: { id: existing.id }, data: { ...pkg, dhabaId } });
    else await prisma.celebrationPackage.create({ data: { ...pkg, dhabaId } });
  }

  // 6. Vouchers — previously hardcoded in the frontend pricing engine, where the
  // browser decided its own discount.
  const vouchers = [
    { code: 'IPL10', description: '10% off, up to ₹100', discountType: 'percent', discountValue: 10, maxDiscountPaise: 100_00, minSubtotalPaise: 300_00 },
    { code: 'SIXER', description: '₹60 off orders over ₹500', discountType: 'flat', discountValue: 60_00, maxDiscountPaise: null, minSubtotalPaise: 500_00 },
    { code: 'HATTRICK', description: '₹150 off orders over ₹1200', discountType: 'flat', discountValue: 150_00, maxDiscountPaise: null, minSubtotalPaise: 1200_00 },
  ];
  for (const voucher of vouchers) {
    await prisma.voucher.upsert({
      where: { code: voucher.code },
      update: voucher,
      create: voucher,
    });
  }

  console.log('✅ Seeding complete.');
}

// Only self-execute when run as a script (`prisma db seed`), not when imported
// by the test harness.
if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .catch((e) => {
      console.error('❌ Seeding Error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
