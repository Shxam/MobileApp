import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PostgreSQL Database for Local + Staging...');

  // 1. Seed Test User
  const user = await prisma.user.upsert({
    where: { phone: '+919876543210' },
    update: {},
    create: {
      phone: '+919876543210',
      name: 'IPL Dhaba Super Fan',
      role: 'customer',
    },
  });

  // 2. Seed Fan Points
  await prisma.fanPoints.upsert({
    where: { userId: user.id },
    update: { balance: 250 },
    create: {
      userId: user.id,
      balance: 250,
    },
  });

  // 3. Seed Menu Items
  const menuItems = [
    {
      name: 'Stadium Special Dum Biryani',
      description: 'Hyderabadi spiced slow-cooked basmati rice with marinated tender pieces',
      price: 349,
      category: 'Biryani',
      image: 'https://cdn.ipldhaba.com/menu/biryani.jpg',
      isVeg: false,
      rating: 4.9,
    },
    {
      name: 'Matchday Paneer Butter Masala',
      description: 'Fresh cottage cheese cubes in rich creamy tomato gravy',
      price: 279,
      category: 'Curries',
      image: 'https://cdn.ipldhaba.com/menu/paneer.jpg',
      isVeg: true,
      rating: 4.8,
    },
    {
      name: 'Floodlit Tandoori Roti Basket',
      description: 'Assorted whole-wheat rotis cooked in clay oven with butter',
      price: 99,
      category: 'Breads',
      image: 'https://cdn.ipldhaba.com/menu/roti.jpg',
      isVeg: true,
      rating: 4.7,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.create({ data: item });
  }

  // 4. Seed Turf Slots
  const now = new Date();
  const turfSlots = [
    {
      pitchName: 'Stadium Box Pitch A',
      startTime: new Date(now.getTime() + 3600000),
      endTime: new Date(now.getTime() + 7200000),
      price: 1200,
      category: 'Floodlit Night',
    },
    {
      pitchName: 'Stadium Box Pitch B',
      startTime: new Date(now.getTime() + 7200000),
      endTime: new Date(now.getTime() + 10800000),
      price: 1500,
      category: 'Late Night T10',
    },
  ];

  for (const slot of turfSlots) {
    await prisma.turfSlot.create({ data: slot });
  }

  console.log('✅ Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
