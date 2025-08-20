// src/routes/listings.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

function getUserIdFromAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret'); // ✅ same secret as server.js/auth.js
    return Number(payload.id || payload.userId || payload.sub);
  } catch {
    return null;
  }
}

// Require auth for all listing routes (owner draft wizard)
router.use((req, res, next) => {
  const uid = getUserIdFromAuth(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { id: uid };
  next();
});

/**
 * GET /listings
 * Return the authenticated owner's draft/published listings (Listing model)
 */
router.get('/', async (req, res, next) => {
  try {
    const ownerId = Number(req.user.id);
    const items = await prisma.listing.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(items);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /listings/:id
 * Return a single listing (only if owned by the requester)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const ownerId = Number(req.user.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const item = await prisma.listing.findFirst({
      where: { id, ownerId },
    });
    if (!item) return res.status(404).json({ error: 'Listing not found' });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /listings
 * Create a new DRAFT listing for this owner (ensure required JSON fields exist).
 */
router.post('/', async (req, res, next) => {
  try {
    const ownerId = Number(req.user.id);
    const {
      title,
      status,
      address,
      use,
      amenities,
      approvals,
      qualifications,
      pricing,
      hours,
      services,
      description,
    } = req.body || {};

    const safeStatus =
      status && Object.values(ListingStatus).includes(status) ? status : ListingStatus.DRAFT;

    // Prisma schema requires `address` (Json) → provide a minimal default if missing
    const addressPayload =
      address && typeof address === 'object'
        ? address
        : { addressLine1: `Draft ${new Date().toLocaleString()}`, city: '', state: '', zip: '' };

    const created = await prisma.listing.create({
      data: {
        ownerId,
        status: safeStatus,
        title: title || 'Untitled Listing',
        address: addressPayload, // ✅ required
        // Optional JSON fields (persist only if provided)
        ...(use !== undefined && { use }),
        ...(amenities !== undefined && { amenities }),
        ...(approvals !== undefined && { approvals }),
        ...(qualifications !== undefined && { qualifications }),
        ...(pricing !== undefined && { pricing }),
        ...(hours !== undefined && { hours }),
        ...(services !== undefined && { services }),
        ...(description !== undefined && { description }),
      },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

/**
 * PUT /listings/:id
 * Update a draft listing you own (allow updating JSON fields used by the wizard).
 * If status transitions to PUBLISHED, promote to a Warehouse (idempotent).
 */
router.put('/:id', async (req, res, next) => {
  try {
    const ownerId = Number(req.user.id);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await prisma.listing.findFirst({ where: { id, ownerId } });
    if (!existing) return res.status(404).json({ error: 'Listing not found' });

    const body = req.body || {};
    const data = {};

    if (typeof body.title === 'string') data.title = body.title;
    if (body.status && Object.values(ListingStatus).includes(body.status)) data.status = body.status;

    // Allow updating the wizard JSON blobs and description
    for (const k of [
      'address',
      'use',
      'amenities',
      'approvals',
      'qualifications',
      'pricing',
      'hours',
      'services',
      'description',
    ]) {
      if (body[k] !== undefined) data[k] = body[k];
    }

    // Save listing first
    const updated = await prisma.listing.update({
      where: { id },
      data,
    });

    // ===== Promotion: Listing → Warehouse =====
    const justPublished =
      (body.status === ListingStatus.PUBLISHED) &&
      (existing.status !== ListingStatus.PUBLISHED);

    if (justPublished) {
      const originTag = `[origin:listing:${id}]`;

      // Idempotency: skip if we already promoted this listing earlier
      const already = await prisma.warehouse.findFirst({
        where: {
          ownerId,
          // description contains our originTag marker
          description: { contains: originTag, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (!already) {
        const addr = updated.address || {};
        const price = updated.pricing || {};
        const name = (updated.title && String(updated.title).trim()) || `Listing ${id}`;
        const baseDesc = (updated.description || '').trim();
        const description = baseDesc ? `${baseDesc}\n\n${originTag}` : originTag;

        // Ultra-small, safe mapping (only common scalar fields on Warehouse)
        const warehouseData = {
          ownerId,
          name,
          address: addr.addressLine1 || null,
          city: addr.city || null,
          state: addr.state || null,
          pincode: addr.zip || null,
          pricePerSqFt:
            price.ratePerSqFtPerMonth != null && price.ratePerSqFtPerMonth !== ''
              ? Number(price.ratePerSqFtPerMonth)
              : null,
          totalSpace:
            price.totalSqFt != null && price.totalSqFt !== ''
              ? Number(price.totalSqFt)
              : null,
          availableSpace:
            price.totalSqFt != null && price.totalSqFt !== ''
              ? Number(price.totalSqFt)
              : null,
          isApproved: false, // Admin must approve before public search
          description,
        };

        // Create the live Warehouse
        await prisma.warehouse.create({ data: warehouseData });
      }
    }
    // =========================================

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
