import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, Send, Sparkles, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { ApiErrorResponse, apiClient, type PlayerCoachChatResponse } from '../api/client';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  evidence?: PlayerCoachChatResponse['evidence'];
};

const SUGGESTIONS = [
  '¿Qué debo priorizar en mis próximas partidas?',
  '¿Qué héroe debería practicar ahora?',
  '¿Cómo va mi objetivo de cinco partidas?',
];

export function PlayerCoachChat({ playerId }: { playerId: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void apiClient.analyst.llmStatus()
        .then((result) => setEnabled(result.enabled))
        .catch(() => setEnabled(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function askCoach(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: clean }]);
    setQuestion('');
    setSending(true);
    try {
      const response = await apiClient.reports.playerCoachChat(playerId, clean, history);
      setMessages((current) => [...current, { role: 'assistant', content: response.answer, evidence: response.evidence }]);
    } catch (error) {
      toast.error(error instanceof ApiErrorResponse ? error.error.message : 'El coach IA no pudo responder.');
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askCoach(question);
  }

  if (enabled === null) return null;

  return (
    <section className="glass-card" style={{ padding: '1.15rem', borderColor: 'rgba(167,139,250,0.32)' }} aria-labelledby="ai-coach-title">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', color: 'var(--accent-violet)', background: 'rgba(167,139,250,0.12)' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h2 id="ai-coach-title" style={{ margin: 0, fontSize: '1.05rem' }}>Pregunta a tu coach IA</h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.72rem' }}>Respuestas basadas únicamente en tus métricas y partidas sincronizadas.</p>
        </div>
      </div>

      {!enabled ? (
        <p style={{ margin: '0.9rem 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>El proveedor de IA todavía no está activado. El informe calculado seguirá funcionando sin él.</p>
      ) : (
        <>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="btn-secondary" onClick={() => void askCoach(suggestion)} style={{ flex: 'unset', fontSize: '0.7rem' }}>
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginTop: '0.9rem', maxHeight: 430, overflowY: 'auto' }} aria-live="polite">
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'stretch', maxWidth: message.role === 'user' ? '82%' : '100%', padding: '0.75rem 0.85rem', borderRadius: 9, background: message.role === 'user' ? 'rgba(34,211,238,0.1)' : 'rgba(167,139,250,0.08)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: message.role === 'user' ? 'var(--accent-cyan)' : 'var(--accent-violet)', fontSize: '0.63rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {message.role === 'user' ? <UserRound size={12} /> : <Bot size={12} />}
                    {message.role === 'user' ? 'Tú' : 'Coach IA'}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.55 }}>{message.content}</p>
                  {message.evidence?.length ? (
                    <details style={{ marginTop: '0.55rem' }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.67rem' }}>Ver evidencias utilizadas ({message.evidence.length})</summary>
                      <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.45rem' }}>
                        {message.evidence.map((item) => (
                          <div key={item.id} style={{ padding: '0.45rem 0.55rem', borderRadius: 6, background: 'rgba(15,23,42,0.5)', fontSize: '0.67rem', lineHeight: 1.4 }}>
                            <strong>{item.id} · {item.label}</strong> <span style={{ color: 'var(--text-muted)' }}>({item.scope})</span>
                            <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              ))}
              {sending ? <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.74rem' }}>Analizando tus datos…</p> : null}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              placeholder="Pregunta sobre tu rol, héroes o últimas partidas…"
              aria-label="Pregunta para el coach IA"
              style={{ flex: 1, minWidth: 0, padding: '0.62rem 0.75rem', borderRadius: 7, border: '1px solid var(--border-color)', background: 'rgba(15,23,42,0.65)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
            />
            <button type="submit" className="btn-primary" disabled={sending || question.trim().length < 2} aria-label="Enviar pregunta" style={{ flex: 'unset', display: 'grid', placeItems: 'center', width: 40 }}>
              <Send size={15} />
            </button>
          </form>
        </>
      )}
    </section>
  );
}
