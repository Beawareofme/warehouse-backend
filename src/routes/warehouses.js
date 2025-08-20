// src/routes/warehouses.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /warehouses
 * Home page expects { warehouses: [...] }
 * Optional query: take (default 24)
 */
router.get('/', async (req, res, next) => {
  try {
    const take = Math.min(parseInt(req.query.take ?? '24', 10) || 24, 100);
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    res.json({ warehouses });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /warehouses/search?q=&minSqFt=&maxSqFt=
 * Search page expects an array (not wrapped)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, minSqFt, maxSqFt } = req.query;

    const where = {
      AND: [
        q
          ? {
              OR: [
                { name:    { contains: q, mode: 'insensitive' } },
                { city:    { contains: q, mode: 'insensitive' } },
                { state:   { contains: q, mode: 'insensitive' } },
                { pincode: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { type:    { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        typeof minSqFt !== 'undefined' && String(minSqFt).trim() !== ''
          ? { availableSpace: { gte: Number(minSqFt) || 0 } }
          : {},
        typeof maxSqFt !== 'undefined' && String(maxSqFt).trim() !== ''
          ? { availableSpace: { lte: Number(maxSqFt) || 0 } }
          : {},
      ],
    };

    const rows = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(rows); // array shape
  } catch (err) {
    next(err);
  }
});

/**
 * GET /warehouses/owner/:id
 * Owner dashboard expects a plain array
 */
router.get('/owner/:id', async (req, res, next) => {
  try {
    const ownerId = Number(req.params.id);
    if (!ownerId) return res.status(400).json({ error: 'Invalid owner id' });

    const rows = await prisma.warehouse.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /warehouses/:id
 * Single warehouse (helps details pages / popups)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const row = await prisma.warehouse.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'Not found' });

    res.json(row);
  } catch (err) {
    next(err);
  }
});

/**
 * (Optional) DELETE /warehouses/:id
 * Your OwnerDashboard uses this path; keep it simple here (auth can be added later).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    await prisma.warehouse.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
