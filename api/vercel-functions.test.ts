import { describe, expect, it } from 'vitest';
import chat from './chat.js';
import health from './health.js';

describe('Vercel Functions', () => {
  it('возвращает состояние API', async () => {
    const response = await health.fetch(new Request('https://example.test/api/health'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('отклоняет неподдерживаемый метод', async () => {
    const response = await health.fetch(new Request('https://example.test/api/health', { method: 'POST' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('валидирует тело чата до обращения к модели', async () => {
    const response = await chat.fetch(new Request('https://example.test/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: 'override' }] })
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
  });
});
