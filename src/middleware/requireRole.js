export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.roles.some(r => allowed.includes(r))) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}
