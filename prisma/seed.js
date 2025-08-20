// prisma/seed.js
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  // A single demo password for all seeded users:
  // 🔑 Demo login: email (below) + password = Demo@1234
  const demoPassword = 'Demo@1234';
  const demoHash = await hash(demoPassword);

  // ===== Users =====
  const merchantOnly = await prisma.user.upsert({
    where: { email: 'priya.merchant@example.com' },
    update: {},
    create: {
      name: 'Priya Shah',
      email: 'priya.merchant@example.com',
      passwordHash: demoHash,
      roles: ['MERCHANT'],
      contactNumber: '9876543210',
      isActive: true,
    },
  });

  const bothOwnerMerchant = await prisma.user.upsert({
    where: { email: 'arjun.ownermerchant@example.com' },
    update: {},
    create: {
      name: 'Arjun Mehta',
      email: 'arjun.ownermerchant@example.com',
      passwordHash: demoHash,
      roles: ['WAREHOUSE_OWNER', 'MERCHANT'],
      contactNumber: '9812345678',
      isActive: true,
    },
  });

  const ownerOnly1 = await prisma.user.upsert({
    where: { email: 'neha.owner@example.com' },
    update: {},
    create: {
      name: 'Neha Iyer',
      email: 'neha.owner@example.com',
      passwordHash: demoHash,
      roles: ['WAREHOUSE_OWNER'],
      contactNumber: '9822001122',
      isActive: true,
    },
  });

  const ownerOnly2 = await prisma.user.upsert({
    where: { email: 'rohit.owner@example.com' },
    update: {},
    create: {
      name: 'Rohit Kumar',
      email: 'rohit.owner@example.com',
      passwordHash: demoHash,
      roles: ['WAREHOUSE_OWNER'],
      contactNumber: '9898989898',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin Singh',
      email: 'admin@example.com',
      passwordHash: demoHash,
      roles: ['ADMIN'],
      contactNumber: '9000000000',
      isActive: true,
    },
  });

  // ===== Warehouses (legacy/owner dashboard) =====
  // Distribute across owners (Arjun / Neha / Rohit)
  const owners = {
    arjun: bothOwnerMerchant.id,
    neha: ownerOnly1.id,
    rohit: ownerOnly2.id,
  };

  await prisma.warehouse.createMany({
    data: [
      {
        name: 'Okhla Logistics Hub',
        ownerId: owners.arjun,
        address: 'A-12, Okhla Phase II',
        city: 'Delhi',
        state: 'DL',
        pincode: '110020',
        type: 'DRY',
        description: 'Ambient storage with easy truck access. Internet + loading dock.',
        totalSpace: 20000,
        availableSpace: 14000,
        pricePerSqFt: new Prisma.Decimal(22.5),
        latitude: 28.5355,
        longitude: 77.3910,
        imageUrl: 'https://picsum.photos/seed/okhla-hub/800/400',
        isApproved: true,
      },
      {
        name: 'Navi Mumbai Cold Store',
        ownerId: owners.neha,
        address: 'Plot 9, TTC Industrial Area',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400703',
        type: 'TEMP_CONTROLLED',
        description: '2 temperature zones, ideal for pharma/food.',
        totalSpace: 30000,
        availableSpace: 18000,
        pricePerSqFt: new Prisma.Decimal(38.0),
        latitude: 19.0330,
        longitude: 73.0297,
        imageUrl: 'https://picsum.photos/seed/navi-cold/800/400',
        isApproved: true,
      },
      {
        name: 'Bhiwandi Fulfillment Center',
        ownerId: owners.arjun,
        address: 'Kongaon, Bhiwandi',
        city: 'Thane',
        state: 'MH',
        pincode: '421308',
        type: 'DRY',
        description: 'High throughput for e-commerce with racking.',
        totalSpace: 45000,
        availableSpace: 32000,
        pricePerSqFt: new Prisma.Decimal(18.5),
        latitude: 19.2813,
        longitude: 73.0483,
        imageUrl: 'https://picsum.photos/seed/bhiwandi-fulfillment/800/400',
        isApproved: true,
      },
      {
        name: 'Peenya Industrial Shed',
        ownerId: owners.rohit,
        address: 'Phase 2, Peenya',
        city: 'Bengaluru',
        state: 'KA',
        pincode: '560058',
        type: 'DRY',
        description: 'Ideal for light assembly & storage. Good power.',
        totalSpace: 18000,
        availableSpace: 9000,
        pricePerSqFt: new Prisma.Decimal(24.0),
        latitude: 13.0309,
        longitude: 77.5153,
        imageUrl: 'https://picsum.photos/seed/peenya-shed/800/400',
        isApproved: true,
      },
      {
        name: 'Guindy City Storage',
        ownerId: owners.neha,
        address: 'SIDCO Industrial Estate, Guindy',
        city: 'Chennai',
        state: 'TN',
        pincode: '600032',
        type: 'DRY',
        description: 'City-proximity storage for FMCG. Forklift available.',
        totalSpace: 15000,
        availableSpace: 7000,
        pricePerSqFt: new Prisma.Decimal(21.0),
        latitude: 13.0108,
        longitude: 80.2120,
        imageUrl: 'https://picsum.photos/seed/guindy-storage/800/400',
        isApproved: false,
      },
      {
        name: 'Kompally Logistics Park',
        ownerId: owners.rohit,
        address: 'NH 44, Kompally',
        city: 'Hyderabad',
        state: 'TG',
        pincode: '500014',
        type: 'DRY',
        description: 'Large bays, trailer parking, security cameras.',
        totalSpace: 52000,
        availableSpace: 41000,
        pricePerSqFt: new Prisma.Decimal(20.0),
        latitude: 17.5463,
        longitude: 78.4858,
        imageUrl: 'https://picsum.photos/seed/kompally-park/800/400',
        isApproved: true,
      },
      {
        name: 'Narol Distribution Center',
        ownerId: owners.neha,
        address: 'Narol Industrial Area',
        city: 'Ahmedabad',
        state: 'GJ',
        pincode: '382405',
        type: 'DRY',
        description: 'Good road connectivity, dock-levelers installed.',
        totalSpace: 26000,
        availableSpace: 15000,
        pricePerSqFt: new Prisma.Decimal(17.5),
        latitude: 22.9606,
        longitude: 72.6009,
        imageUrl: 'https://picsum.photos/seed/narol-dc/800/400',
        isApproved: true,
      },
      {
        name: 'Chakan Auto Hub',
        ownerId: owners.arjun,
        address: 'MIDC, Chakan Phase 2',
        city: 'Pune',
        state: 'MH',
        pincode: '410501',
        type: 'DRY',
        description: 'Auto ancillaries storage, wide access roads.',
        totalSpace: 34000,
        availableSpace: 19000,
        pricePerSqFt: new Prisma.Decimal(23.5),
        latitude: 18.7519,
        longitude: 73.8429,
        imageUrl: 'https://picsum.photos/seed/chakan-auto/800/400',
        isApproved: false,
      },
    ],
    skipDuplicates: true,
  });

  // ===== Listings (wizard-style JSON, PUBLISHED) =====
  await prisma.listing.create({
    data: {
      ownerId: owners.arjun,
      status: 'PUBLISHED',
      title: 'Okhla Ambient Storage with Dock Access',
      description:
        'Clean ambient storage ideal for consumer products/apparel. 7 days a week, forklift on site.',
      address: {
        addressLine1: 'A-12, Okhla Phase II',
        city: 'Delhi',
        state: 'DL',
        zip: '110020',
      },
      use: { facilityUse: 'STORAGE_LIGHT', otherUseNotes: '' },
      amenities: {
        security: {
          gatedAccess: true,
          onSiteGuards: false,
          securitySystem: true,
          securityCameras: true,
        },
        forklift: { available: true, isPaid: false, maxWeightKg: 2000 },
        amenities: ['INTERNET', 'LOADING_DOCK', 'OFFICE_SPACE'],
      },
      approvals: {
        labourPolicy: {
          renterLaborAllowed: true,
          ownerLaborAvailable: true,
          includedInRent: false,
          hourlyRate: 350,
        },
        approvedUses: ['CONSUMER_PRODUCTS', 'APPAREL', 'LOGISTICS_3PL'],
      },
      qualifications: ['DRY'],
      pricing: {
        totalSqFt: 20000,
        minSqFt: 1000,
        ratePerSqFtPerMonth: 22.5,
      },
      hours: {
        mode: 'SEVEN_DAYS',
        time: 'LIMITED',
        range: { open: '09:00', close: '18:00' },
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
      services: {
        inbound: { palletReceiving: { available: true, ratePerHour: 450 } },
        outbound: { unitPickPack: { available: true, ratePerHour: 500 } },
        valueAdd: { kitting: { available: false, ratePerHour: 0 } },
      },
    },
  });

  await prisma.listing.create({
    data: {
      ownerId: owners.rohit,
      status: 'PUBLISHED',
      title: 'Peenya Shed for Light Assembly & Storage',
      description:
        'Power-ready shed in Peenya with flexible hours. Great for small assembly + storage.',
      address: {
        addressLine1: 'Phase 2, Peenya',
        city: 'Bengaluru',
        state: 'KA',
        zip: '560058',
      },
      use: { facilityUse: 'SMALL_ASSEMBLY', otherUseNotes: '' },
      amenities: {
        security: {
          gatedAccess: true,
          onSiteGuards: true,
          securitySystem: true,
          securityCameras: true,
        },
        forklift: { available: false, isPaid: false, maxWeightKg: 0 },
        amenities: ['SPECIALTY_POWER', 'INTERNET', 'RESTROOMS'],
      },
      approvals: {
        labourPolicy: {
          renterLaborAllowed: true,
          ownerLaborAvailable: false,
          includedInRent: false,
          hourlyRate: 0,
        },
        approvedUses: ['ELECTRONICS', 'GENERAL_WORK', 'CONSUMER_PRODUCTS'],
      },
      qualifications: ['DRY'],
      pricing: {
        totalSqFt: 18000,
        minSqFt: 800,
        ratePerSqFtPerMonth: 24.0,
      },
      hours: {
        mode: 'SELECTED',
        time: '24H',
        range: { open: '00:00', close: '23:59' },
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      },
      services: {
        inbound: { cartonReceiving: { available: true, ratePerHour: 300 } },
        outbound: { cartonPick: { available: true, ratePerHour: 350 } },
        valueAdd: { ticketing: { available: true, ratePerHour: 280 } },
      },
    },
  });

  console.log('✅ Seed complete');
  console.table([
    { role: 'MERCHANT', email: merchantOnly.email },
    { role: 'OWNER+MERCHANT', email: bothOwnerMerchant.email },
    { role: 'OWNER', email: ownerOnly1.email },
    { role: 'OWNER', email: ownerOnly2.email },
    { role: 'ADMIN', email: adminUser.email },
  ]);
  console.log('🔑 Demo password for all seeded users:', demoPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
