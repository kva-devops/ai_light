import { config } from '../server/config.js';
import { askConsultant, ProxyError } from '../server/proxy.js';
import { validateMessages, ValidationError } from '../server/validation.js';

type ClientCounter = {
  count: number;
  concurrent: number;
  resetAt: number;
};

const counters = new Map<string, ClientCounter>();

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function acquireRequestSlot(ip: string): { error?: Response; release?: () => void } {
  const now = Date.now();
  let counter = counters.get(ip);

  if (!counter || counter.resetAt <= now) {
    counter = { count: 0, concurrent: 0, resetAt: now + config.rateLimitWindowMs };
    counters.set(ip, counter);
  }

  if (counter.count >= config.rateLimitMax) {
    return { error: jsonError('RATE_LIMIT', 'Слишком много запросов. Попробуйте позже.', 429) };
  }
  if (counter.concurrent >= config.maxConcurrentPerIp) {
    return { error: jsonError('RATE_LIMIT', 'Дождитесь завершения предыдущих запросов.', 429) };
  }

  counter.count += 1;
  counter.concurrent += 1;
  let released = false;

  return {
    release: () => {
      if (released) return;
      released = true;
      const current = counters.get(ip);
      if (current) current.concurrent = Math.max(0, current.concurrent - 1);
    }
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json(
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Метод не поддерживается.' } },
        { status: 405, headers: { Allow: 'POST' } }
      );
    }

    const slot = acquireRequestSlot(getClientIp(request));
    if (slot.error) return slot.error;

    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError('BAD_REQUEST', 'Некорректный JSON.', 400);
      }

      const messages = validateMessages(
        body && typeof body === 'object' ? (body as { messages?: unknown }).messages : undefined
      );
      const message = await askConsultant(messages);
      return Response.json({ message });
    } catch (error) {
      if (error instanceof ValidationError) {
        return jsonError('BAD_REQUEST', error.message, 400);
      }
      if (error instanceof ProxyError) {
        return jsonError(error.code, error.message, error.status);
      }
      return jsonError('UNAVAILABLE', 'Не удалось подготовить ответ. Попробуйте ещё раз.', 500);
    } finally {
      slot.release?.();
    }
  }
};
