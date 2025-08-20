import express from 'express';
import { prisma } from '../lib/prisma.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { sendEmail } from '../lib/email.js';

const router = express.Router();
const ui = (s) => s.toLowerCase();

// compat for Home.jsx (POST /book)
router.post('/../book', (req, res, next) => next()); // no-op; real handler below

// POST /bookings  (and compat /book via app.use)
router.post('/', auth(), requireRole('MERCHANT'), async (req, res) => {
  const merchantId = req.user.id;
  const warehouseId = Number(req.body.warehouseId);
  const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!wh || wh.status !== 'PUBLISHED' || !wh.isApproved || wh.isDisabledByAdmin)
    return res.status(400).json({ error: 'Warehouse not bookable' });

  const b = await prisma.booking.create({
    data: { warehouseId, merchantId, status: 'PENDING', events: { create: [{ status: 'PENDING' }] } }
  });
  res.status(201).json({ id: b.id, status: 'pending', createdAt: b.createdAt });
});

// GET /bookings/:id  (BookingDetails.jsx)
router.get('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id);
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      warehouse: { include: { owner: true } },
      merchant: true,
      events: { orderBy: { createdAt: 'asc' } }
    }
  });
  if (!b) return res.status(404).json({ error: 'Not found' });

  const u = req.user;
  const canView =
    u.roles.includes('ADMIN') ||
    (u.roles.includes('MERCHANT') && u.id === b.merchantId) ||
    (u.roles.includes('WAREHOUSE_OWNER') && u.id === b.warehouse.ownerId);
  if (!canView) return res.status(403).json({ error: 'Forbidden' });

  res.json({
    id: b.id,
    status: ui(b.status),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    statusHistory: (b.events || []).map(e => ({ status: ui(e.status), date: e.createdAt })),
    warehouse: {
      id: b.warehouse.id,
      name: b.warehouse.title || `Warehouse in ${[b.warehouse.city,b.warehouse.state].filter(Boolean).join(', ')}`,
      address: b.warehouse.addressLine1,
      city: b.warehouse.city, state: b.warehouse.state, pincode: b.warehouse.zip,
      owner: {
        id: b.warehouse.owner.id,
        name: b.warehouse.owner.name,
        email: b.warehouse.owner.email,
        contactNumber: b.warehouse.owner.contactNumber || null
      }
    },
    merchant: { id: b.merchant.id, name: b.merchant.name, email: b.merchant.email }
  });
});

// GET /bookings/merchant/:id
router.get('/merchant/:id', auth(), async (req, res) => {
  const id = Number(req.params.id);
  if (!(req.user.roles.includes('ADMIN') || (req.user.roles.includes('MERCHANT') && req.user.id === id)))
    return res.status(403).json({ error: 'Forbidden' });

  const rows = await prisma.booking.findMany({
    where: { merchantId: id },
    orderBy: { createdAt: 'desc' },
    include: { warehouse: true }
  });
  res.json(rows.map(b => ({
    id: b.id, status: ui(b.status), createdAt: b.createdAt,
    warehouse: { id: b.warehouse.id, name: b.warehouse.title || b.warehouse.city || 'Warehouse' }
  })));
});

// GET /bookings/owner/:id
router.get('/owner/:id', auth(), async (req, res) => {
  const id = Number(req.params.id);
  if (!(req.user.roles.includes('ADMIN') || (req.user.roles.includes('WAREHOUSE_OWNER') && req.user.id === id)))
    return res.status(403).json({ error: 'Forbidden' });

  const rows = await prisma.booking.findMany({
    where: { warehouse: { ownerId: id } },
    orderBy: { createdAt: 'desc' },
    include: { merchant: true, warehouse: true }
  });
  res.json(rows.map(b => ({
    id: b.id, status: ui(b.status), createdAt: b.createdAt,
    merchant: { id: b.merchant.id, name: b.merchant.name, email: b.merchant.email },
    warehouse: { id: b.warehouse.id, name: b.warehouse.title || b.warehouse.city || 'Warehouse' }
  })));
});

// PUT /bookings/:id  (owner/admin)
router.put('/:id', auth(), async (req, res) => {
  const id = Number(req.params.id);
  const to = String(req.body.status || '').toUpperCase(); // ACCEPTED/REJECTED/CANCELED
  const b = await prisma.booking.findUnique({ where: { id }, include: { warehouse: true } });
  if (!b) return res.status(404).json({ error: 'Not found' });

  const isOwner = req.user.roles.includes('WAREHOUSE_OWNER') && req.user.id === b.warehouse.ownerId;
  if (!(req.user.roles.includes('ADMIN') || isOwner))
    return res.status(403).json({ error: 'Forbidden' });

  const allowed = b.status === 'PENDING'
    ? ['ACCEPTED','REJECTED','CANCELED']
    : (b.status === 'ACCEPTED' ? ['CANCELED'] : []);
  if (!allowed.includes(to)) return res.status(422).json({ error: 'Invalid transition' });

  const updated = await prisma.booking.update({ where: { id }, data: { status: to } });
  await prisma.bookingEvent.create({ data: { bookingId: id, status: to } });
  res.json({ id: updated.id, status: ui(updated.status), updatedAt: updated.updatedAt });
});

// POST /bookings/message  (owner -> merchant)
router.post('/message', auth(), requireRole('WAREHOUSE_OWNER'), async (req, res) => {
  const { bookingId, merchantEmail, message } = req.body || {};
  const b = await prisma.booking.findUnique({ where: { id: Number(bookingId) }, include: { warehouse: true } });
  if (!b || b.warehouse.ownerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  await sendEmail({ to: merchantEmail, subject: `Message about booking #${b.id}`, text: message || '' });
  await prisma.bookingEvent.create({ data: { bookingId: b.id, status: b.status, note: `OWNER_MSG: ${message || ''}` } });
  res.json({ ok: true });
});

export default router;
