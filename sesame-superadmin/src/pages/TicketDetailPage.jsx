import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { downloadFile, errorMessage } from '../lib/api';
import { get, useAdmins, useDepartments } from '../lib/queries';
import { formatDateTime, formatDuration, formatTime, formatDate, STATUS, PRIORITY } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import { Button, EmptyState, ErrorBlock, SelectField, Skeleton, useConfirm, useToast } from '../components/ui';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/TicketBadges';

function Message({ message }) {
  const kind = message.senderRole === 'system' ? 'system' : message.isInternal ? 'internal' : message.senderRole === 'user' ? 'user' : 'staff';
  const toast = useToast();
  return (
    <div className={`msg ${kind}`}>
      {kind !== 'system' ? <span className="who">{kind === 'internal' ? `Note interne · ${message.senderName}` : message.senderName}</span> : null}
      <div className="bubble">
        {message.content}
        {message.attachment ? (
          <div>
            <button type="button" className="attachment" onClick={() => downloadFile(message.attachment.url, message.attachment.name).catch((error) => toast.error(errorMessage(error)))}>
              <Icon name="paperclip" size={14} /> {message.attachment.name}
            </button>
          </div>
        ) : null}
      </div>
      <time dateTime={message.createdAt} title={formatDateTime(message.createdAt)}>{formatDate(message.createdAt)} · {formatTime(message.createdAt)}</time>
    </div>
  );
}

function Conversation({ ticket }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const [content, setContent] = useState('');
  const [internal, setInternal] = useState(false);
  const [file, setFile] = useState(null);
  const messages = useQuery({ queryKey: ['messages', ticket.id], queryFn: () => get(`/tickets/${ticket.id}/messages`) });
  const replies = useQuery({ queryKey: ['canned-replies', ticket.department?.id], queryFn: () => get('/canned-replies', { departmentId: ticket.department?.id }) });

  // Opening (or receiving messages in) the conversation marks it read for me.
  useEffect(() => {
    if (!messages.data) return;
    api.post(`/tickets/${ticket.id}/read`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['unread'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }).catch(() => {});
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.data, ticket.id, queryClient]);

  const send = useMutation({
    mutationFn: () => {
      if (file) {
        const form = new FormData();
        form.append('content', content.trim());
        form.append('isInternal', String(internal));
        form.append('attachment', file);
        return api.post(`/tickets/${ticket.id}/messages`, form);
      }
      return api.post(`/tickets/${ticket.id}/messages`, { content: content.trim(), isInternal: internal });
    },
    onSuccess: () => {
      setContent('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event) => {
    event.preventDefault();
    if ((content.trim() || file) && !send.isPending) send.mutate();
  };

  return (
    <section className="card conversation" aria-label="Conversation">
      <div className="messages" ref={listRef}>
        {messages.isPending ? <Skeleton rows={3} height={52} /> : null}
        {messages.isError ? <ErrorBlock error={errorMessage(messages.error)} onRetry={messages.refetch} /> : null}
        {messages.data?.content.map((message) => <Message key={message.id} message={message} />)}
      </div>
      {ticket.status === 'closed' ? (
        <div className="composer"><p className="muted small">Ce ticket est fermé. Rouvrez-le (statut « En cours ») pour répondre.</p></div>
      ) : (
        <form className={`composer ${internal ? 'internal' : ''}`} onSubmit={submit}>
          <label className="sr-only" htmlFor="reply">{internal ? 'Note interne' : 'Réponse à l’étudiant'}</label>
          <textarea
            id="reply"
            className="textarea"
            placeholder={internal ? 'Note visible uniquement par l’équipe…' : 'Répondre à l’étudiant… (Ctrl+Entrée pour envoyer)'}
            value={content}
            maxLength={4000}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event); }}
          />
          <div className="row">
            <label className="checkbox"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /><span>Note interne</span></label>
            {replies.data?.length ? (
              <select className="select" style={{ width: 'auto', minHeight: 30 }} aria-label="Insérer une réponse type" value=""
                onChange={(event) => {
                  const reply = replies.data.find((item) => item.id === Number(event.target.value));
                  if (reply) setContent((current) => (current.trim() ? `${current.trim()}\n\n${reply.content}` : reply.content));
                }}>
                <option value="">Réponse type…</option>
                {replies.data.map((reply) => <option key={reply.id} value={reply.id}>{reply.title}</option>)}
              </select>
            ) : null}
            <input ref={fileRef} type="file" className="sr-only" id="reply-file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <label htmlFor="reply-file" className="btn btn-ghost btn-sm"><Icon name="paperclip" size={15} />{file ? file.name : 'Joindre'}</label>
            {file ? <Button variant="ghost" size="sm" icon="x" aria-label="Retirer la pièce jointe" onClick={() => { setFile(null); fileRef.current.value = ''; }} /> : null}
            <span className="spacer" />
            <span className="muted small">{content.length}/4000</span>
            <Button type="submit" icon="send" loading={send.isPending} disabled={!content.trim() && !file}>{internal ? 'Ajouter la note' : 'Envoyer'}</Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { account, isOwner } = useAuth();
  const departments = useDepartments();
  const admins = useAdmins();
  const ticket = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => get(`/tickets/${id}`) });

  const update = useMutation({
    mutationFn: (changes) => api.patch(`/tickets/${id}`, changes).then((response) => response.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['ticket', Number(id)], data);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['messages', Number(id)] });
      toast.success('Ticket mis à jour');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (ticket.isPending) return <Skeleton rows={5} height={60} />;
  if (ticket.isError) {
    return ticket.error?.response?.status === 404
      ? <EmptyState icon="ticket" title="Ticket introuvable" description="Il a peut-être été supprimé ou n’appartient pas à votre service." action={<Link className="btn btn-secondary" to="/tickets">Retour aux tickets</Link>} />
      : <ErrorBlock error={errorMessage(ticket.error)} onRetry={ticket.refetch} />;
  }
  const t = ticket.data;

  const changeStatus = async (status) => {
    if (status === t.status) return;
    const messages = {
      closed: 'L’étudiant sera notifié et ne pourra plus écrire, sauf s’il rouvre le ticket.',
      open: 'Le ticket repassera dans la file « Ouverts ».',
      in_progress: 'Le ticket sera marqué comme en cours de traitement.',
    };
    if (await confirm({ title: `Passer le ticket en « ${STATUS[status].label} » ?`, message: messages[status], confirmLabel: 'Confirmer' })) {
      update.mutate({ status });
    }
  };

  const transfer = async (departmentId) => {
    const department = departments.data?.find((item) => item.id === Number(departmentId));
    if (department && await confirm({ title: 'Transférer le ticket ?', message: `Le ticket sera transféré au service « ${department.name} » et désassigné.`, confirmLabel: 'Transférer' })) {
      update.mutate({ departmentId: department.id });
      if (account.department && account.department.id !== department.id) navigate('/tickets');
    }
  };

  const remove = async () => {
    if (await confirm({ title: 'Supprimer définitivement ce ticket ?', message: 'La conversation et ses pièces jointes seront supprimées. Préférez la fermeture pour garder l’historique.', confirmLabel: 'Supprimer', danger: true })) {
      try {
        await api.delete(`/tickets/${id}`);
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        toast.success('Ticket supprimé');
        navigate('/tickets');
      } catch (error) {
        toast.error(errorMessage(error));
      }
    }
  };

  const eligibleAgents = (admins.data || []).filter((admin) => admin.isActive && (!admin.department || admin.department.id === t.department?.id));

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/tickets" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}><Icon name="arrowLeft" size={15} />Tickets</Link>
          <h1 style={{ marginTop: 6 }}><span className="muted mono">#{t.id}</span> {t.title}</h1>
          <div className="row" style={{ marginTop: 8 }}>
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            <SlaBadge ticket={t} />
          </div>
        </div>
        {isOwner ? <Button variant="danger-ghost" icon="trash" onClick={remove}>Supprimer</Button> : null}
      </div>

      <div className="ticket-layout">
        <Conversation ticket={t} />
        <aside className="stack">
          <div className="card card-body stack">
            <h2>Traitement</h2>
            <SelectField label="Statut" value={t.status} onChange={(event) => changeStatus(event.target.value)} disabled={update.isPending}>
              {Object.entries(STATUS).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
            </SelectField>
            <SelectField label="Priorité" value={t.priority} onChange={(event) => update.mutate({ priority: event.target.value })} disabled={update.isPending}>
              {Object.entries(PRIORITY).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
            </SelectField>
            <SelectField label="Assigné à" value={t.assignedTo?.id || ''} onChange={(event) => update.mutate({ assignedToId: event.target.value ? Number(event.target.value) : null })} disabled={update.isPending}>
              <option value="">Personne</option>
              {eligibleAgents.map((admin) => <option key={admin.id} value={admin.id}>{admin.displayName || admin.login}{admin.id === account.id ? ' (moi)' : ''}</option>)}
            </SelectField>
            {t.assignedTo?.id !== account.id ? <Button variant="secondary" size="sm" onClick={() => update.mutate({ assignedToId: account.id })}>M’assigner ce ticket</Button> : null}
            <SelectField label="Service" value={t.department?.id || ''} onChange={(event) => transfer(event.target.value)} disabled={update.isPending}>
              {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}{department.isActive ? '' : ' (inactif)'}</option>)}
            </SelectField>
          </div>
          <div className="card card-body stack">
            <h2>Informations</h2>
            <dl className="detail-list">
              <dt>Étudiant</dt><dd>{t.user ? `${t.user.name} (${t.user.login})` : 'Compte supprimé'}</dd>
              <dt>Créé le</dt><dd>{formatDateTime(t.createdAt)}</dd>
              <dt>1ʳᵉ réponse</dt><dd>{t.firstResponseAt ? `${formatDateTime(t.firstResponseAt)} (${formatDuration((new Date(t.firstResponseAt) - new Date(t.createdAt)) / 3600000)})` : 'En attente'}</dd>
              <dt>Fermé le</dt><dd>{t.closedAt ? formatDateTime(t.closedAt) : '—'}</dd>
              <dt>Satisfaction</dt><dd>{t.rating ? `${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}${t.ratingComment ? ` — « ${t.ratingComment} »` : ''}` : '—'}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
