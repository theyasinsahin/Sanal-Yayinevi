import { rateError } from './rateLimit.js';

export function allowedOrigins(env = process.env) {
  const origins = new Set(['capacitor://localhost', 'https://localhost', 'http://localhost']);
  if (env.NODE_ENV !== 'production') origins.add('http://localhost:3000');
  for (const value of [env.CLIENT_URL, ...(env.CORS_ALLOWED_ORIGINS || '').split(',')].filter(Boolean)) {
    const url = new URL(value.trim());
    if (!['https:', ...(env.NODE_ENV === 'production' ? [] : ['http:'])].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Geçerli bir istemci origin yapılandırın.');
    origins.add(url.origin);
  }
  return origins;
}

export function configureHttpSecurity(app, env = process.env) {
  app.disable('x-powered-by');
  // Do not trust arbitrary X-Forwarded-For. Configure exact proxy CIDRs only.
  app.set('trust proxy', env.TRUSTED_PROXY_CIDRS ? env.TRUSTED_PROXY_CIDRS.split(',').map(value => value.trim()).filter(Boolean) : false);
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'Cache-Control': 'no-store' });
    if (env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
}

export function websocketAddress(app, request) {
  // Upgrade requests do not pass through Express. Reuse Express's public req.ip
  // getter with the same configured proxy trust, rather than counting an entire
  // reverse proxy as one client or trusting X-Forwarded-For unconditionally.
  request.app = app;
  return Reflect.get(app.request, 'ip', request);
}

// A bounded per-process shield runs before parsers and DB lookups. Persistent
// operation quotas provide the shared control; spoofed proxy headers do not count.
export function requestShield({ limit = 900, windowMs = 60000, maxKeys = 10000, now = Date.now } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now(), key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      for (const [id, value] of buckets) if (value.until <= time) buckets.delete(id);
      if (!buckets.has(key) && buckets.size >= maxKeys) return res.status(503).json({ error: 'SERVICE_BUSY' });
      bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket);
    }
    if (++bucket.count > limit) { res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.until - time) / 1000)))); return res.status(429).json({ error: rateError().extensions.code }); }
    next();
  };
}

export function httpError(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'encoding.unsupported' ? 415 : error.type === 'entity.parse.failed' ? 400 : 500;
  return res.status(status).json({ error: status === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST', message: status === 500 ? 'İşlem tamamlanamadı.' : 'İstek biçimi veya boyutu geçersiz.' });
}
