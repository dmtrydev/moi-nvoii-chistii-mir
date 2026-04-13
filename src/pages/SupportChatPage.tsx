import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Send, Users } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL ?? '');

function getApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, '');
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : path;
}

interface ConversationItem {
  id: number;
  userId: number;
  status: string;
  subject: string | null;
  lastMessageAt: string;
  userEmail?: string;
  userFullName?: string;
  unreadForAdmin?: number;
}

interface MessageItem {
  id: number;
  conversationId: number;
  authorUserId: number;
  authorRole: 'USER' | 'ADMIN' | string;
  bodyText: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  createdAt: string;
  authorEmail: string;
  authorFullName: string | null;
}

export default function SupportChatPage(): JSX.Element {
  const { accessToken, user } = useAuth();
  const isAdmin = user?.role === 'SUPERADMIN';
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
    }),
    [accessToken],
  );

  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    if (isAdmin) {
      const resp = await fetch(getApiUrl('/api/support/conversations'), { headers, credentials: 'include' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error((data as { message?: string }).message ?? 'Не удалось загрузить диалоги');
      const list = Array.isArray((data as { items?: ConversationItem[] }).items)
        ? (data as { items: ConversationItem[] }).items
        : [];
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
      return;
    }
    const resp = await fetch(getApiUrl('/api/support/conversations/mine'), { headers, credentials: 'include' });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error((data as { message?: string }).message ?? 'Не удалось загрузить чат');
    const convo = (data as { conversation?: ConversationItem }).conversation;
    if (convo) {
      setConversations([convo]);
      setActiveConversationId(convo.id);
    } else {
      setConversations([]);
      setActiveConversationId(null);
    }
  }, [accessToken, activeConversationId, headers, isAdmin]);

  const loadMessages = useCallback(async () => {
    if (!accessToken || !activeConversationId) return;
    const resp = await fetch(getApiUrl(`/api/support/conversations/${activeConversationId}/messages`), {
      headers,
      credentials: 'include',
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error((data as { message?: string }).message ?? 'Не удалось загрузить сообщения');
    const items = Array.isArray((data as { items?: MessageItem[] }).items) ? (data as { items: MessageItem[] }).items : [];
    setMessages(items);
    await fetch(getApiUrl(`/api/support/conversations/${activeConversationId}/read`), {
      method: 'POST',
      headers,
      credentials: 'include',
    }).catch(() => {});
  }, [accessToken, activeConversationId, headers]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loadConversations()
      .then(() => {
        if (!alive) return;
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Ошибка');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    loadMessages().catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'));
    const id = setInterval(() => {
      loadMessages().catch(() => {});
      if (isAdmin) {
        loadConversations().catch(() => {});
      }
    }, 4000);
    return () => clearInterval(id);
  }, [activeConversationId, isAdmin, loadConversations, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!activeConversationId || !accessToken) return;
    if (!text.trim() && !attachment) return;
    setSending(true);
    setError('');
    try {
      const fd = new FormData();
      if (text.trim()) fd.append('text', text.trim());
      if (attachment) fd.append('attachment', attachment);
      const resp = await fetch(getApiUrl(`/api/support/conversations/${activeConversationId}/messages`), {
        method: 'POST',
        headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' },
        credentials: 'include',
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error((data as { message?: string }).message ?? 'Не удалось отправить сообщение');
      setText('');
      setAttachment(null);
      await loadMessages();
      if (isAdmin) await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  }, [accessToken, activeConversationId, attachment, isAdmin, loadConversations, loadMessages, text]);

  const openAttachment = useCallback(
    async (messageId: number) => {
      if (!accessToken) return;
      try {
        const resp = await fetch(getApiUrl(`/api/support/messages/${messageId}/attachment`), {
          headers,
          credentials: 'include',
        });
        if (!resp.ok) throw new Error('Не удалось открыть файл');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка открытия вложения');
      }
    },
    [accessToken, headers],
  );

  return (
    <div className="w-full max-w-6xl mx-auto page-enter">
      <div className="glass-shell p-4 md:p-6 min-h-[calc(100vh-9rem)]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="glass-kicker">Support</p>
            <h1 className="typo-h1 mt-1">Чат поддержки</h1>
          </div>
          {isAdmin && (
            <div className="glass-chip">
              <Users className="h-4 w-4" />
              Админ-режим
            </div>
          )}
        </div>

        {loading && <div className="glass-panel p-4 text-sm text-ink-muted">Загрузка чата...</div>}
        {!loading && error && <div className="glass-panel p-4 text-sm glass-danger">{error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 min-h-[65vh]">
            <aside className="glass-panel p-3 overflow-auto brand-scroll">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted px-2 py-1">
                {isAdmin ? 'Диалоги' : 'Ваш диалог'}
              </p>
              <div className="mt-2 space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConversationId(c.id)}
                    className={[
                      'w-full text-left rounded-2xl p-3 transition-all',
                      c.id === activeConversationId ? 'bg-accent-soft shadow-sm' : 'bg-app-bg hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold text-ink">
                      {isAdmin ? c.userFullName || c.userEmail || `User #${c.userId}` : 'Поддержка'}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {new Date(c.lastMessageAt).toLocaleString()}
                    </div>
                    {isAdmin && Number(c.unreadForAdmin ?? 0) > 0 && (
                      <div className="mt-2 inline-flex rounded-full bg-[#ffedd5] px-2 py-0.5 text-[11px] text-[#9a3412]">
                        Непрочитано: {c.unreadForAdmin}
                      </div>
                    )}
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="px-3 py-4 text-sm text-ink-muted">Диалогов пока нет</div>
                )}
              </div>
            </aside>

            <section className="glass-panel p-4 md:p-5 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-auto brand-scroll pr-1 space-y-3">
                {messages.map((m) => {
                  const mine = Number(m.authorUserId) === Number(user?.id);
                  return (
                    <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                      <div
                        className={[
                          'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                          mine
                            ? 'bg-gradient-to-br from-accent-from to-accent-to text-[#1a2e12]'
                            : 'bg-app-bg text-ink',
                        ].join(' ')}
                      >
                        <div className="text-[11px] opacity-75 mb-1">
                          {m.authorFullName || m.authorEmail} · {new Date(m.createdAt).toLocaleTimeString()}
                        </div>
                        {m.bodyText && <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.bodyText}</div>}
                        {m.attachmentOriginalName && (
                          <button
                            type="button"
                            onClick={() => void openAttachment(m.id)}
                            className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-2"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {m.attachmentOriginalName}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-sm text-ink-muted px-2 py-3">Сообщений пока нет. Напишите в поддержку.</div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="mt-4 border-t border-black/[0.06] pt-4 space-y-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Напишите сообщение..."
                  className="glass-input !h-24 !py-3 resize-none"
                />
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <label className="inline-flex items-center gap-2 glass-btn-soft cursor-pointer">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm">{attachment ? attachment.name : 'Скриншот'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setAttachment(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={sending || (!text.trim() && !attachment)}
                    className="glass-btn-dark disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {sending ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
