import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';

const SOCKET_URL = api.defaults.baseURL;

function time(value) {
  return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function TicketChat({ ticket, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const markRead = useCallback(async () => {
    try {
      await api.post(`/tickets/${ticket.id}/messages/read`);
    } catch {
      // Keep the conversation usable if the read receipt cannot be saved.
    }
  }, [ticket.id]);

  useEffect(() => {
    let active = true;
    api.get(`/tickets/${ticket.id}/messages`).then(async (response) => {
      if (!active) return;
      setMessages(response.data.content || []);
      await markRead();
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.error || 'Impossible de charger la conversation.');
    }).finally(() => { if (active) setLoading(false); });

    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('token') }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('ticket:join', ticket.id));
    socket.on('ticket:message', (message) => {
      if (Number(message.ticketId) !== Number(ticket.id)) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderRole === 'user') markRead();
    });
    return () => {
      active = false;
      socket.emit('ticket:leave', ticket.id);
      socket.disconnect();
    };
  }, [ticket.id, markRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      const response = await api.post(`/tickets/${ticket.id}/messages`, { content });
      setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
    } catch (requestError) {
      setInput(content);
      setError(requestError.response?.data?.error || 'Impossible d’envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={s.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section style={s.popup} aria-label={`Conversation du ticket ${ticket.id}`}>
        <header style={s.header}>
          <div style={{ minWidth: 0 }}>
            <div style={s.headerTitle}>Ticket #{ticket.id} · Conversation</div>
            <div style={s.headerSub}>{ticket.title}</div>
          </div>
          <button type="button" onClick={onClose} style={s.close} aria-label="Fermer la conversation">×</button>
        </header>
        <div ref={listRef} style={s.messageList}>
          {loading ? <div style={s.state}>Chargement de la conversation…</div> : messages.length === 0 ? <div style={s.state}>Aucun message. Vous pouvez commencer la conversation.</div> : messages.map((message) => {
            const own = message.senderRole === 'superadmin';
            return (
              <div key={message.id} style={{ ...s.row, justifyContent: own ? 'flex-end' : 'flex-start' }}>
                <div style={{ ...s.group, alignItems: own ? 'flex-end' : 'flex-start' }}>
                  <div style={{ ...s.role, color: own ? '#64748B' : '#1a56db' }}>{own ? 'Support' : message.senderName || 'Étudiant'}</div>
                  <div style={{ ...s.bubble, ...(own ? s.ownBubble : s.receivedBubble) }}>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.content}</div>
                    <time style={{ ...s.time, color: own ? '#9CA3AF' : 'rgba(255,255,255,.72)' }}>{time(message.createdAt)}</time>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {error && <div role="alert" style={s.error}>{error}</div>}
        {ticket.status === 'closed' ? <div style={s.closed}>Ce ticket est fermé. Rouvrez-le pour continuer la conversation.</div> : (
          <form onSubmit={send} style={s.inputBar}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Écrire un message…" maxLength={4000} rows={1} style={s.input} disabled={sending} />
            <button type="submit" disabled={!input.trim() || sending} style={{ ...s.send, opacity: !input.trim() || sending ? 0.6 : 1 }}>Envoyer</button>
          </form>
        )}
      </section>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 24, background: 'rgba(15,23,42,.34)' },
  popup: { width: 'min(460px, 100%)', height: 'min(620px, 82vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 18, background: '#F7F8FA', boxShadow: '0 20px 60px rgba(0,0,0,.24)' },
  header: { minHeight: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', color: '#fff', background: '#0d1b4b' },
  headerTitle: { fontSize: 15, fontWeight: 700 },
  headerSub: { marginTop: 3, color: '#CBD5E1', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  close: { width: 32, height: 32, flexShrink: 0, border: 0, borderRadius: 16, background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 24, cursor: 'pointer' },
  messageList: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 },
  row: { display: 'flex', marginBottom: 14 },
  group: { maxWidth: '84%', display: 'flex' },
  role: { marginBottom: 4, fontSize: 10, fontWeight: 700 },
  bubble: { minWidth: 64, borderRadius: 16, padding: '10px 13px', fontSize: 14, lineHeight: 1.45 },
  ownBubble: { color: '#111827', background: '#F3F4F6', borderBottomRightRadius: 4 },
  receivedBubble: { color: '#fff', background: '#1a56db', borderBottomLeftRadius: 4 },
  time: { display: 'block', marginTop: 5, fontSize: 10, textAlign: 'right' },
  state: { display: 'grid', height: '100%', placeItems: 'center', color: '#6B7280', fontSize: 13, textAlign: 'center' },
  error: { padding: '0 14px 8px', color: '#DC2626', fontSize: 12 },
  inputBar: { display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderTop: '1px solid #E5E7EB', background: '#fff' },
  input: { flex: 1, minHeight: 42, maxHeight: 96, resize: 'none', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 20, outline: 'none', background: '#F9FAFB', font: 'inherit', fontSize: 13 },
  send: { minHeight: 40, padding: '0 14px', border: 0, borderRadius: 20, color: '#fff', background: '#1a56db', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  closed: { padding: 14, textAlign: 'center', color: '#6B7280', background: '#fff', fontSize: 12 },
};
