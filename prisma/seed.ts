import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SEED_MENU_ITEMS } from './seed-data/menu';

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

  // 3. Menu — the dhaba's real card, from prisma/seed-data/menu.ts.
  //
  // The three rows this replaced pointed their images at `cdn.ipldhaba.com`, a
  // host that does not resolve, so every dish tile rendered a broken image. The
  // real menu and its photographs were sitting in the frontend mock module the
  // whole time; they now live in Postgres where the pricing service can read
  // them.
  //
  // Names are matched rather than ids because `name` is not unique in the schema
  // (two dhabas may both sell biryani). One read plus a batch insert keeps this
  // to a handful of round-trips instead of one per dish — it runs in the Jest
  // global setup, so 76 sequential queries against Neon would be felt on every
  // test run.
  const existingItems = await prisma.menuItem.findMany({
    where: { dhabaId },
    select: { id: true, name: true },
  });
  const itemIdByName = new Map(existingItems.map((row) => [row.name, row.id]));

  const newItems = SEED_MENU_ITEMS.filter((item) => !itemIdByName.has(item.name));
  if (newItems.length > 0) {
    await prisma.menuItem.createMany({ data: newItems.map((item) => ({ ...item, dhabaId })) });
  }
  await Promise.all(
    SEED_MENU_ITEMS.filter((item) => itemIdByName.has(item.name)).map((item) =>
      prisma.menuItem.update({ where: { id: itemIdByName.get(item.name) }, data: { ...item, dhabaId } }),
    ),
  );
  console.log(`   • ${SEED_MENU_ITEMS.length} menu items (${newItems.length} new).`);

  // 4. Turf + slots
  //
  // Coordinates, amenities and the pitch description are the real ones from the
  // Singarayakonda ground — `LiveTrackingMap` and the turf detail sheet both read
  // them, and a null latitude leaves the map centred on the dhaba fallback.
  // `image`/`gallery` stay empty: the only pictures the old mock had were
  // Unsplash stock photos of somebody else's pitch, and both views already skip
  // the hero when there is nothing real to show.
  const turfName = 'IPL Dhaba Box Turf — Singarayakonda';
  const turfData = {
    name: turfName,
    location: 'NH-16, Singarayakonda, Prakasam Dist',
    area: 'Singarayakonda',
    address: 'NH-16 Bypass Road, Next to IPL Dhaba Kitchen, Singarayakonda, Andhra Pradesh',
    latitude: 15.25,
    longitude: 80.03,
    pricePerHourPaise: 1200_00,
    pitchType: 'Floodlit Pro Cage',
    amenities: [
      'Floodlights 500 Lux',
      'Dhaba Dining Deck',
      'Live Scoring Screen',
      'Dressing Room AC',
      'Free Parking',
      'Equipment Rental',
    ],
    description:
      'Singarayakonda’s floodlit box-cricket turf, attached to the dhaba kitchen — order biryani and starters straight to your team bench between innings.',
    rating: 4.9,
    reviewsCount: 512,
  };

  let turf = await prisma.turf.findFirst({ where: { name: turfName, dhabaId } });
  if (turf) {
    turf = await prisma.turf.update({ where: { id: turf.id }, data: turfData });
  } else {
    turf = await prisma.turf.create({ data: { ...turfData, dhabaId } });
  }

  // A week of bookable hours across both pitches, rather than the two
  // now-plus-an-hour slots this replaced. The booking grid groups by day, so a
  // pair of slots left it with a single column and nothing to page through, and
  // both were in the past within two hours of seeding.
  //
  // Rates follow the counter: daylight hours are the base rate and the floodlit
  // evening slots carry the premium.
  const PITCHES = ['Pitch A', 'Pitch B'];
  const OPEN_HOUR = 15; // 3 PM — earlier hours are too hot to play here.
  const CLOSE_HOUR = 23;
  const FLOODLIT_FROM = 18;

  // Midnight today, so a re-seed on the same day lands on identical timestamps
  // and the `findFirst` below recognises the slots it already wrote.
  const dayZero = new Date();
  dayZero.setHours(0, 0, 0, 0);

  const slotRows: Array<{
    turfId: string;
    pitchName: string;
    startTime: Date;
    endTime: Date;
    pricePaise: number;
    category: string;
    isFloodlit: boolean;
  }> = [];

  for (let day = 0; day < 7; day += 1) {
    for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) {
      for (const pitch of PITCHES) {
        const startTime = new Date(dayZero);
        startTime.setDate(startTime.getDate() + day);
        startTime.setHours(hour, 0, 0, 0);
        // A slot that has already started cannot be booked; skip rather than
        // seed rows the availability query will filter out anyway.
        if (startTime.getTime() <= Date.now()) continue;

        const isFloodlit = hour >= FLOODLIT_FROM;
        slotRows.push({
          turfId: turf.id,
          pitchName: `${turfName} ${pitch}`,
          startTime,
          endTime: new Date(startTime.getTime() + 3600_000),
          pricePaise: isFloodlit ? 1500_00 : 1200_00,
          category: isFloodlit ? 'Floodlit Night' : 'Daylight Hour',
          isFloodlit,
        });
      }
    }
  }

  // One read of what is already there beats a findFirst per slot: this runs in
  // the Jest global setup, and ~90 sequential round-trips to Neon is seconds of
  // every test run.
  const existingSlots = await prisma.turfSlot.findMany({
    where: { turfId: turf.id, startTime: { gte: dayZero } },
    select: { pitchName: true, startTime: true },
  });
  const seenSlots = new Set(existingSlots.map((s) => `${s.pitchName}@${s.startTime.toISOString()}`));
  const freshSlots = slotRows.filter((s) => !seenSlots.has(`${s.pitchName}@${s.startTime.toISOString()}`));
  if (freshSlots.length > 0) {
    await prisma.turfSlot.createMany({ data: freshSlots });
  }
  console.log(`   • ${slotRows.length} turf slots over 7 days (${freshSlots.length} new).`);

  // 5. Celebration packages — the dhaba's real party package, bilingual.
  //
  // The two rows this replaced ('Match Day Birthday Bash', 'Team Victory Party')
  // were invented during the rebuild: English-only, with prices and inclusions
  // nobody at the counter had agreed to. The genuine package — the one the
  // Hindi/English toggle in CelebrationsView was written for — was in the frontend
  // mock module, so it moves here alongside the menu.
  //
  // `image` stays empty: the mock's only picture was an Unsplash stock photo of
  // someone else's party.
  const packages = [
    {
      title: 'Grand Indian Style Turf Party Bash',
      titleHi: 'ग्रैंड इंडियन स्टाइल टर्फ पार्टी बैश',
      subtitle:
        'Ultimate Indian Party Celebration: Floodlit Box Turf Match + Unlimited Dhaba Feast & Live DJ',
      subtitleHi: 'शानदार भारतीय पार्टी उत्सव: फ्लडलाइट टर्फ मैच + असीमित ढाबा दावत और डीजे',
      basePricePaise: 5999_00,
      recommendedFor: '15 - 30 Guests & Players',
      rating: 4.9,
      inclusions: [
        '2 Hours Reserved Floodlit Box Turf Match at Singarayakonda',
        'Grand Festive Indian Party Decor & LED Scoreboard Banner',
        'Unlimited Hot Dhaba Starters, Biryani Handi & Chilled Lassi',
        'Live DJ Setup with Commentary Mic & Match Music',
        'Custom Champions Trophy & Player Medals Ceremony',
        'Special Cake Cutting Setup & Photo Booth Backdrop',
      ],
      inclusionsHi: [
        'सिंगरायाकोंडा में 2 घंटे आरक्षित फ्लडलाइट बॉक्स टर्फ',
        'भव्य भारतीय पार्टी सजावट और एलईडी बैनर',
        'असीमित ढाबा स्टार्टर्स, बिरयानी और ठंडी लस्सी',
        'लाइव डीजे और कमेंट्री साउंड सेटअप',
        'विजेता ट्रॉफी और खिलाड़ी पदक समारोह',
        'विशेष केक कटिंग सेटअप और फोटो बूथ',
      ],
    },
  ];
  for (const pkg of packages) {
    const existing = await prisma.celebrationPackage.findFirst({ where: { title: pkg.title, dhabaId } });
    if (existing) await prisma.celebrationPackage.update({ where: { id: existing.id }, data: { ...pkg, dhabaId } });
    else await prisma.celebrationPackage.create({ data: { ...pkg, dhabaId } });
  }

  // Retire the two invented packages on any database that already has them.
  // Deactivated rather than deleted: `CelebrationBooking.packageId` is a foreign
  // key, so a dev database with a test booking against one would fail the delete —
  // and a sold party should keep pointing at what was sold. `isActive: false` is
  // what the customer listing filters on.
  const retired = await prisma.celebrationPackage.updateMany({
    where: { dhabaId, title: { in: ['Match Day Birthday Bash', 'Team Victory Party'] } },
    data: { isActive: false },
  });
  console.log(`   • ${packages.length} celebration package(s) (${retired.count} placeholder(s) retired).`);

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
