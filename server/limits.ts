import type { RequestHandler } from 'express';
import { config } from './config.js';

type Counter = { count: number; resetAt: number; concurrent: number };
const counters = new Map<string, Counter>();

function clientKey(ip: string | undefined): string {
  return ip || 'unknown';
}

export const requestLimits: RequestHandler = (request, response, next) => {
  const key = clientKey(request.ip);
  const now = Date.now();
  let counter = counters.get(key);
  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, concurrent: 0, resetAt: now + config.rateLimitWindowMs };
    counters.set(key, counter);
  }

  if (counter.count >= config.rateLimitMax) {
    response.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Слишком много запросов. Попробуйте позже.' } });
    return;
  }
  if (counter.concurrent >= config.maxConcurrentPerIp) {
    response.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Дождитесь завершения предыдущих запросов.' } });
    return;
  }

  counter.count += 1;
  counter.concurrent += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const current = counters.get(key);
    if (current) current.concurrent = Math.max(0, current.concurrent - 1);
  };
  response.once('finish', release);
  response.once('close', release);
  next();
};

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now && counter.concurrent === 0) counters.delete(key);
  }
}, config.rateLimitWindowMs);
cleanup.unref();
