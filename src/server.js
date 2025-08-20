// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import warehouseRoutes from './routes/warehouses.js';
import bookingRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';

const app = express();
const prisma = new PrismaClient();

// --- CORS & body parsing ---
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

// --- Simple request logger (helps when things look "stuck") ---
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Healthcheck ---
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// --- Mount routers to match your frontend ---
app.use('/api/auth', authRoutes);          // Register/Login/Me
app.use('/listings', listingRoutes);       // Draft wizard
app.use('/warehouses', warehouseRoutes);   // Search, list, owner list, CRUD
app.use('/bookings', bookingRoutes);       // Booking flows
app.use('/admin', adminRoutes);            // Admin

// ===================================================================
// Compatibility shims (fallbacks) — only run if upstream didn't match
// These match exactly what your React app calls.
// ===================================================================

// GET /warehouses  → preferred shape { warehouses: [...] }
app.get('/warehouses', async (_req, res, next) => {
  try {
    const rows = await prisma.warehouse.findMany({ orderBy: { id: 'desc' } });
    // Return as an object so Home.jsx can read data.warehouses
    res.json({ warehouses: rows });
  } catch (err) {
    next(err);
  }
});

// GET /warehouses/search?q=&minSqFt=
app.get('/warehouses/search', async (req, res, next) => {
  try {
    const { q, minSqFt } = req.query;
    const where = {
      AND: [
        q
          ? {
              OR: [
                { city:    { contains: q, mode: 'insensitive' } },
                { state:   { contains: q, mode: 'insensitive' } },
                { pincode: { contains: q, mode: 'insensitive' } },
                { name:    { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {},
        minSqFt ? { availableSpace: { gte: Number(minSqFt) || 0 } } : {},
      ],
    };
    const rows = await prisma.warehouse.findMany({ where, orderBy: { id: 'desc' } });
    // SearchResults.jsx expects an array
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /warehouses/owner/:id
app.get('/warehouses/owner/:id', async (req, res, next) => {
  try {
    const ownerId = Number(req.params.id);
    if (!ownerId) return res.status(400).json({ error: 'Invalid owner id' });
    const rows = await prisma.warehouse.findMany({
      where: { ownerId },
      orderBy: { id: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /book  → alias for creating a booking (Home.jsx uses this path)
// Requires Bearer token; extracts user id from JWT and creates PENDING booking
app.post('/book', async (req, res, next) => {
  try {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // ✅ Use same secret as other routes and support id or userId
    const secret = process.env.JWT_SECRET || 'dev_secret';
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { warehouseId } = req.body || {};
    if (!warehouseId) return res.status(400).json({ error: 'warehouseId is required' });

    const uidRaw = payload.id ?? payload.userId;
    const uid = Number(uidRaw);
    if (!Number.isFinite(uid)) return res.status(401).json({ error: 'Invalid token payload' });

    const booking = await prisma.booking.create({
      data: {
        merchantId: uid,
        warehouseId: Number(warehouseId),
        status: 'PENDING',
      },
      include: {
        warehouse: true,
      },
    });

    res.json(booking);
  } catch (err) {
    next(err);
  }
});

// --- Errors ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
