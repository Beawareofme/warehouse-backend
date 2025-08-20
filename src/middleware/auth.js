import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export function auth(optional = false) {
  return async (req, res, next) => {
    const hdr = req.get('Authorization') || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) {
      if (optional) return next();
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
