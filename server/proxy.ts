import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.js';
import { calculateLighting } from './lighting.js';
import type { BrowserMessage } from './validation.js';

type ProxyMessage = BrowserMessage | {
  role: 'system' | 'tool' | 'assistant';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type ProxyResponse = {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
};

export class ProxyError extends Error {
  constructor(
    public code: 'CONFIGURATION' | 'RATE_LIMIT' | 'UNAVAILABLE' | 'TIMEOUT' | 'NETWORK',
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function getApiKey(): Promise<string> {
  const environmentKey = process.env.PROXY_API_KEY?.trim();
  if (environmentKey) return environmentKey;
  try {
    const fileKey = (await readFile(resolve('apikey.txt'), 'utf8')).trim();
    if (fileKey) return fileKey;
  } catch {
    // Ошибка ниже намеренно не раскрывает пути и внутренние детали.
  }
  throw new ProxyError('CONFIGURATION', 'Сервис ещё не настроен: отсутствует API-ключ.', 503);
}

async function callProxy(messages: ProxyMessage[], signal: AbortSignal): Promise<ProxyResponse> {
  const apiKey = await getApiKey();
  let response: Response;
  try {
    response = await fetch(config.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.35,
        tools: [{
          type: 'function',
          function: {
            name: 'calculate_lighting',
            description: 'Выполняет проверяемый ориентировочный расчёт требуемого светового потока и количества светильников.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                area: { type: 'number', description: 'Площадь помещения в м²' },
                targetLux: { type: 'number', description: 'Целевая освещённость в люксах' },
                fixtureLumens: { type: 'number', description: 'Световой поток одного светильника в люменах' }
              },
              required: ['area', 'targetLux']
            }
          }
        }],
        tool_choice: 'auto'
      }),
      signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProxyError('TIMEOUT', 'Ответ занял слишком много времени. Попробуйте ещё раз.', 504);
    }
    throw new ProxyError('NETWORK', 'Не удалось связаться с сервисом. Проверьте сеть и повторите запрос.', 502);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new ProxyError('RATE_LIMIT', 'Лимит запросов к модели исчерпан. Попробуйте немного позже.', 429);
    }
    if (response.status >= 500) {
      throw new ProxyError('UNAVAILABLE', 'Сервис временно недоступен. Попробуйте позже.', 503);
    }
    throw new ProxyError('UNAVAILABLE', 'Сервис не смог обработать запрос. Попробуйте ещё раз.', 502);
  }

  try {
    return await response.json() as ProxyResponse;
  } catch {
    throw new ProxyError('UNAVAILABLE', 'Сервис вернул некорректный ответ.', 502);
  }
}

function toolResult(call: ToolCall): ProxyMessage {
  try {
    const args = JSON.parse(call.function.arguments) as {
      area?: unknown;
      targetLux?: unknown;
      fixtureLumens?: unknown;
    };
    const result = calculateLighting({
      area: Number(args.area),
      targetLux: Number(args.targetLux),
      ...(args.fixtureLumens === undefined ? {} : { fixtureLumens: Number(args.fixtureLumens) })
    });
    return { role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) };
  } catch (error) {
    return {
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({ error: error instanceof Error ? error.message : 'Некорректные параметры расчёта.' })
    };
  }
}

export async function askConsultant(messages: BrowserMessage[]): Promise<string> {
  const prompt = await readFile(resolve('server/system-prompt.md'), 'utf8');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const prepared: ProxyMessage[] = [{ role: 'system', content: prompt }, ...messages];

  try {
    const first = await callProxy(prepared, controller.signal);
    const modelMessage = first.choices?.[0]?.message;
    const toolCalls = modelMessage?.tool_calls?.filter((call) => call.function.name === 'calculate_lighting') ?? [];

    if (toolCalls.length > 0) {
      const secondMessages: ProxyMessage[] = [
        ...prepared,
        { role: 'assistant', content: modelMessage?.content ?? null, tool_calls: toolCalls },
        ...toolCalls.map(toolResult)
      ];
      const second = await callProxy(secondMessages, controller.signal);
      const content = second.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    }

    const content = modelMessage?.content?.trim();
    if (!content) throw new ProxyError('UNAVAILABLE', 'Сервис вернул пустой ответ.', 502);
    return content;
  } finally {
    clearTimeout(timeout);
  }
}
