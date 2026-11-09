function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: positiveInt(process.env.PORT, 3000),
  proxyUrl: process.env.PROXY_API_URL ?? 'https://api.proxyapi.ru/v1/chat/completions',
  model: process.env.PROXY_API_MODEL ?? 'openai/gpt-4o-mini',
  requestTimeoutMs: positiveInt(process.env.REQUEST_TIMEOUT_MS, 30_000),
  rateLimitWindowMs: positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 5 * 60_000),
  rateLimitMax: positiveInt(process.env.RATE_LIMIT_MAX, 10),
  maxConcurrentPerIp: positiveInt(process.env.MAX_CONCURRENT_PER_IP, 2),
  maxMessageLength: 2_000,
  maxMessages: 20
};
