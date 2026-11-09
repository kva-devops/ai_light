import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = { role: 'user' | 'assistant'; content: string };
type ChatError = { code: string; message: string };

const examples = [
  'Сколько света нужно для кухни 14 м²?',
  'Какую температуру выбрать для спальни?',
  'Как избежать бликов над рабочим столом?'
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [lastFailed, setLastFailed] = useState<Message[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error]);

  async function request(nextMessages: Message[]) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-20) })
      });
      const data = await response.json().catch(() => null) as
        | { message?: string; error?: ChatError }
        | null;
      if (!response.ok || !data?.message) {
        throw data?.error ?? { code: 'NETWORK', message: 'Не удалось получить ответ. Попробуйте ещё раз.' };
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.message! }]);
      setLastFailed(null);
    } catch (caught) {
      const chatError = caught && typeof caught === 'object' && 'message' in caught
        ? caught as ChatError
        : { code: 'NETWORK', message: 'Нет связи с сервером. Проверьте сеть и повторите запрос.' };
      setError(chatError);
      setLastFailed(nextMessages);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function send(text = draft) {
    const content = text.trim();
    if (!content || loading || content.length > 2000) return;
    const userMessage: Message = { role: 'user', content };
    const nextMessages = [...messages, userMessage].slice(-20);
    setMessages(nextMessages);
    setDraft('');
    void request(nextMessages);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function startNewDialog() {
    if (loading) return;
    setMessages([]);
    setDraft('');
    setError(null);
    setLastFailed(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const hasConversation = messages.length > 0;

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Световой консультант — в начало">
          <span className="brand-mark">✳</span>
          <span>LIGHT / 01</span>
        </a>
        <div className="status" aria-label="Сервис доступен">
          <span className="status-dot" />
          консультант онлайн
        </div>
        <button className="new-dialog" type="button" onClick={startNewDialog} disabled={loading || !hasConversation}>
          Новый диалог <span aria-hidden="true">↗</span>
        </button>
      </header>

      <main id="top" className={hasConversation ? 'main conversation-active' : 'main'}>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-index">ИНТЕРЬЕРНЫЙ СВЕТ / AI</div>
          <h1 id="page-title">
            СВЕТОВОЙ
            <span>КОНСУЛЬТАНТ<span className="asterisk">✳</span></span>
          </h1>
          <div className="intro-bottom">
            <p>
              Помогаю дизайнерам собирать световые сценарии, проверять расчёты и принимать решения без лишней теории.
            </p>
            <div className="orbit" aria-hidden="true"><span>3000K</span></div>
          </div>
        </section>

        <section className="chat-panel" aria-label="Диалог со световым консультантом">
          <div className="chat-head">
            <span>ДИАЛОГ / {String(Math.floor(messages.length / 2) + 1).padStart(2, '0')}</span>
            <span className="chat-head-note">Только текст · история не сохраняется</span>
          </div>

          <div className="messages" aria-live="polite" aria-busy={loading}>
            {!hasConversation && (
              <div className="welcome">
                <p className="eyebrow">С ЧЕГО НАЧНЁМ?</p>
                <h2>Опишите помещение<br />или выберите пример.</h2>
                <div className="examples">
                  {examples.map((example, index) => (
                    <button type="button" key={example} onClick={() => send(example)}>
                      <span>0{index + 1}</span>
                      {example}
                      <ArrowIcon />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-meta">
                  <span>{message.role === 'user' ? 'ВЫ' : 'КОНСУЛЬТАНТ'}</span>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="message-body">
                  {message.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  ) : <p>{message.content}</p>}
                </div>
              </article>
            ))}

            {loading && (
              <div className="thinking" role="status">
                <span className="thinking-mark">✳</span>
                <span>Проверяю условия и готовлю рекомендацию</span>
                <span className="dots"><i /><i /><i /></span>
              </div>
            )}

            {error && (
              <div className="error-card" role="alert">
                <div><span>!</span></div>
                <p><strong>{error.code === 'RATE_LIMIT' ? 'Лимит запросов' : 'Не удалось ответить'}</strong>{error.message}</p>
                <button type="button" onClick={() => lastFailed && request(lastFailed)} disabled={loading || !lastFailed}>
                  Повторить <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={submit}>
            <label htmlFor="question">Ваш вопрос</label>
            <div className="input-wrap">
              <textarea
                id="question"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 2000))}
                onKeyDown={handleKeyDown}
                placeholder="Например: подберите сценарии света для кухни-гостиной 28 м²…"
                rows={2}
                maxLength={2000}
                disabled={loading}
              />
              <button className="send" type="submit" disabled={loading || !draft.trim()} aria-label="Отправить сообщение">
                <ArrowIcon />
              </button>
            </div>
            <div className="composer-hint">
              <span><kbd>Enter</kbd> отправить · <kbd>Shift + Enter</kbd> новая строка</span>
              <span className={draft.length > 1800 ? 'counter warning' : 'counter'}>{draft.length} / 2000</span>
            </div>
          </form>
        </section>
      </main>

      <footer>
        <span>LIGHT CONSULTANT © 2026</span>
        <span>Расчёты ориентировочные, не проектная документация</span>
      </footer>
    </div>
  );
}
