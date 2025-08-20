export function notFound(req, res, next) {
  res.status(404).json({ error: 'Not Found' });
}
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server Error' });
}
