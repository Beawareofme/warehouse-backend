// src/routes/admin.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// ---------------- Helpers ----------------
function readToken(req) {
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
  } catch {
    return null;
  }
}

function computePrimaryRole(userLike) {
  const arr = Array.isArray(userLike?.roles)
    ? userLike.roles
    : (userLike?.role ? [String(userLike.role).toUpperCase()] : []);
  if (arr.includes('ADMIN')) return 'admin';
  if (arr.includes('WAREHOUSE_OWNER')) return 'owner';
  if (arr.includes('MERCHANT')) return 'merchant';
  return 'user';
}

// Require ADMIN for everything under /admin
// ❗️CHANGED: check roles from the DATABASE (not from the token)
router.use(async (req, res, next) => {
  const payload = readToken(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const userId = Number(payload.id);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    const roles = dbUser?.roles || [];
    const isAdmin = roles.includes('ADMIN');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    req.user = { id: userId, roles };
    next();
  } catch (e) {
    next(e);
  }
});

// ---------------- Users ----------------
router.get('/users', async (_req, res, next) => {
  try {
    const rows = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const shaped = rows.map(u => ({
      ...u,
      role: computePrimaryRole(u),
    }));

    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id/role', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const wanted = String(req.body?.role || '').toUpperCase();
    if (!id || !wanted) return res.status(400).json({ error: 'Invalid request' });

    const curr = await prisma.user.findUnique({
      where: { id },
      select: { roles: true },
    });
    if (!curr) return res.status(404).json({ error: 'User not found' });

    const newRoles = Array.from(new Set([...(curr.roles || []), wanted]));
    const user = await prisma.user.update({
      where: { id },
      data: { roles: newRoles },
      select: { id: true, name: true, email: true, roles: true },
    });

    res.json({ ...user, role: computePrimaryRole(user) });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user id' });

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------- Warehouses ----------------
const warehouseSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  type: true,
  description: true,
  pricePerSqFt: true,
  totalSpace: true,
  availableSpace: true,
  latitude: true,
  longitude: true,
  imageUrl: true,
  isApproved: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: { id: true, name: true, email: true },
  },
};

router.get('/warehouses', async (_req, res, next) => {
  try {
    const rows = await prisma.warehouse.findMany({
      select: warehouseSelect,
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/warehouses/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const isApproved = !!req.body?.isApproved;
    if (!id) return res.status(400).json({ error: 'Invalid warehouse id' });

    const updated = await prisma.warehouse.update({
      where: { id },
      data: { isApproved },
      select: warehouseSelect,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/warehouses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid warehouse id' });

    await prisma.warehouse.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------- Bookings ----------------
router.get('/bookings', async (_req, res, next) => {
  try {
    const rows = await prisma.booking.findMany({
      include: {
        warehouse: { select: warehouseSelect },
        merchant: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
