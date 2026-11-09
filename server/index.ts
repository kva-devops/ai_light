import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { requestLimits } from './limits.js';
import { askConsultant, ProxyError } from './proxy.js';
import { validateMessages, ValidationError } from './validation.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_request, response) => response.json({ ok: true }));

app.post('/api/chat', requestLimits, async (request, response) => {
  try {
    const messages = validateMessages(request.body?.messages);
    const message = await askConsultant(messages);
    response.json({ message });
  } catch (error) {
    if (error instanceof ValidationError) {
      response.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
      return;
    }
    if (error instanceof ProxyError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    response.status(500).json({ error: { code: 'UNAVAILABLE', message: 'Не удалось подготовить ответ. Попробуйте ещё раз.' } });
  }
});

if (process.env.NODE_ENV === 'production') {
  const serverDir = dirname(fileURLToPath(import.meta.url));
  const clientDir = resolve(serverDir, '../dist');
  app.use(express.static(clientDir));
  app.get('*splat', (_request, response) => response.sendFile(resolve(clientDir, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Некорректный JSON.' } });
    return;
  }
  next(error);
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Световой консультант: http://127.0.0.1:${config.port}`);
});
