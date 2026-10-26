export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  console.error(`[error] ${status} — ${message}`, err.stack ? `\n${err.stack}` : '');

  res.status(status).json({
    error: { message, status },
  });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
}
