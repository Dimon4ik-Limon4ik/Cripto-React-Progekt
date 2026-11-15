// Простой in-memory лимитер попыток: ключ -> { count, resetAt }.
// Внешние зависимости не нужны; при нескольких процессах счётчики
// независимы, но для защиты от брутфорса на одном инстансе этого достаточно.
const attempts = new Map();
const MAX_KEYS = 10_000;

const cleanup = setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}, 60_000);

// Таймер не должен держать процесс живым (важно для тестов и скриптов).
cleanup.unref?.();

export default function rateLimit({ windowMs, max, keyOf, message }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = keyOf(req);
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      // Безопасная деградация вместо неограниченного роста памяти.
      if (attempts.size >= MAX_KEYS) {
        attempts.clear();
      }

      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}
