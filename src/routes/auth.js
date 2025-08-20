import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { toLegacyRole } from '../lib/adapters.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// ✅ Use one consistent secret everywhere (matches server.js & listings.js)
const SECRET = process.env.JWT_SECRET || 'devsecret';

function makeToken(user) {
  // include both `id` and `sub` to satisfy any consumer that reads either
  return jwt.sign({ id: user.id, sub: user.id, roles: user.roles }, SECRET, { expiresIn: '7d' });
}

function serializeUser(u) {
  const role = toLegacyRole(u);          // legacy single role string for the frontend
  const { passwordHash, ...safe } = u;
  return { ...safe, role };              // keep roles[] and add role
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, roles } = req.body || {};
  if (!name || !email || !password || !Array.isArray(roles) || roles.length === 0)
    return res.status(400).json({ error: 'Name, email, password, roles required' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
      roles: roles.filter(Boolean),
    },
  });

  const token = makeToken(user);
  res.json({ token, user: serializeUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = makeToken(user);
  res.json({ token, user: serializeUser(user) });
});

// GET /api/auth/me
router.get('/me', auth(), async (req, res) => {
  res.json(serializeUser(req.user));
});

export default router;
