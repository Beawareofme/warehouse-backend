// scripts/backfill_promote_listings.js
import 'dotenv/config';
import { PrismaClient, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.env.DRY_RUN === '1';

function toNumberOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function run() {
  const listings = await prisma.listing.findMany({
    where: { status: ListingStatus.PUBLISHED },
    orderBy: { updatedAt: 'asc' },
  });

  console.log(`Found ${listings.length} published listing(s).`);

  let created = 0, skipped = 0;
  for (const l of listings) {
    const originTag = `[origin:listing:${l.id}]`;

    // Already promoted?
    const exists = await prisma.warehouse.findFirst({
      where: {
        ownerId: l.ownerId,
        description: { contains: originTag, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (exists) {
      console.log(`- Listing #${l.id}: already promoted (warehouse id ${exists.id}) → skip`);
      skipped++;
      continue;
    }

    // Minimal mapping (same as route)
    const addr = l.address || {};
    const price = l.pricing || {};
    const name = (l.title && String(l.title).trim()) || `Listing ${l.id}`;
    const baseDesc = (l.description || '').trim();
    const description = baseDesc ? `${baseDesc}\n\n${originTag}` : originTag;

    const data = {
      ownerId: l.ownerId,
      name,
      address: addr.addressLine1 || null,
      city: addr.city || null,
      state: addr.state || null,
      pincode: addr.zip || null,
      pricePerSqFt: toNumberOrNull(price.ratePerSqFtPerMonth),
      totalSpace: toNumberOrNull(price.totalSqFt),
      availableSpace: toNumberOrNull(price.totalSqFt),
      isApproved: false, // admin will approve after backfill
      description,
    };

    if (DRY) {
      console.log(`- Listing #${l.id}: DRY RUN → would create warehouse with`, data);
      created++; // count as “would create” so you see the impact
    } else {
      const w = await prisma.warehouse.create({ data });
      console.log(`- Listing #${l.id}: created warehouse #${w.id}`);
      created++;
    }
  }

  console.log(`Done. ${created} created, ${skipped} skipped.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
