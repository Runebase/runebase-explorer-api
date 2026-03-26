import logger from '../utils/logger.mjs';

// Simple in-memory rate limiter (can be swapped for Redis-backed later)
const store = new Map();
export function ratelimit({
  duration = 600000,
  max = 600,
  whitelist = []
} = {}) {
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (let [key, entry] of store) {
      if (now - entry.start > duration) {
        store.delete(key);
      }
    }
  }, 60000).unref();
  return (req, res, next) => {
    let ip = req.get('cf-connecting-ip') || req.get('x-forwarded-for') || req.ip;
    let appId = req.get('application-id');
    if (whitelist.includes(ip) || appId && whitelist.includes(appId)) {
      return next();
    }
    let key = `runebase-explorer-api-${ip}`;
    let now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.start > duration) {
      entry = {
        count: 0,
        start: now
      };
      store.set(key, entry);
    }
    entry.count++;
    let remaining = Math.max(0, max - entry.count);
    let reset = Math.ceil((entry.start + duration - now) / 1000);
    res.set('Rate-Limit-Remaining', remaining.toString());
    res.set('Rate-Limit-Reset', reset.toString());
    res.set('Rate-Limit-Total', max.toString());
    if (entry.count > max) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded'
      });
    }
    next();
  };
}