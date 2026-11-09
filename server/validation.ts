import { config } from './config.js';

export type BrowserMessage = { role: 'user' | 'assistant'; content: string };

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateMessages(value: unknown): BrowserMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('Передайте непустую историю сообщений.');
  }
  if (value.length > config.maxMessages) {
    throw new ValidationError(`В истории может быть не более ${config.maxMessages} сообщений.`);
  }

  const messages = value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Сообщение ${index + 1} имеет неверный формат.`);
    }
    const { role, content } = item as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') {
      throw new ValidationError('Допустимы только роли user и assistant.');
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Сообщение не может быть пустым.');
    }
    if (content.length > config.maxMessageLength) {
      throw new ValidationError(`Сообщение не должно превышать ${config.maxMessageLength} символов.`);
    }
    return { role, content: content.trim() } as BrowserMessage;
  });

  if (messages.at(-1)?.role !== 'user') {
    throw new ValidationError('Последнее сообщение должно быть от пользователя.');
  }
  return messages;
}
