const buckets = new Map();

function makeKey(req, name) {
  const rawIp = (req.ip || req.headers['x-forwarded-for'] || '').toString();
  const ip = rawIp.split(',')[0].trim() || 'unknown';
  return `${name}:${ip}`;
}

export function rateLimit({ name, windowMs, max }) {
  return (req, res, next) => {
    const key = makeKey(req, name);
    const now = Date.now();

    let entry = buckets.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
    }

    entry.count += 1;
    buckets.set(key, entry);

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ message: 'Слишком много запросов, попробуйте позже' });
    }

    return next();
  };
}

