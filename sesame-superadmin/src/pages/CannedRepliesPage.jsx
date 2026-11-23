import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { get, useDepartments } from '../lib/queries';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, EmptyState, ErrorBlock, Modal, PageHeader, SelectField, Skeleton, TextField, useConfirm, useToast } from '../components/ui';

function ReplyForm({ reply, onClose }) {
  const { account } = useAuth();
  const departments = useDepartments();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    title: reply?.title || '',
    content: reply?.content || '',
    departmentId: reply ? reply.department?.id || '' : account.department?.id || '',
  });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const body = { title: form.title.trim(), content: form.content.trim(), departmentId: form.departmentId ? Number(form.departmentId) : null };
      return reply ? api.patch(`/canned-replies/${reply.id}`, body) : api.post('/canned-replies', body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['canned-replies'] }); toast.success('Réponse enregistrée'); onClose(); },
    onError: (requestError) => setError(errorMessage(requestError)),
  });
  return (
    <Modal title={reply ? 'Modifier la réponse type' : 'Nouvelle réponse type'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="reply-form" loading={save.isPending}>Enregistrer</Button></>}>
      <form id="reply-form" className="stack" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Titre (visible par l’équipe)" value={form.title} maxLength={100} required onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Wi-Fi : réinitialiser la connexion" />
        <TextField as="textarea" rows={6} label="Texte envoyé à l’étudiant" value={form.content} maxLength={4000} required onChange={(event) => setForm({ ...form, content: event.target.value })} />
        <SelectField label="Service" value={form.departmentId} disabled={Boolean(account.department)} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
          hint={account.department ? 'Vos réponses types sont rattachées à votre service.' : 'Vide = disponible pour tous les services.'}>
          <option value="">Tous les services</option>
          {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </SelectField>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function CannedRepliesPage() {
  const replies = useQuery({ queryKey: ['canned-replies'], queryFn: () => get('/canned-replies') });
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const remove = async (reply) => {
    if (!(await confirm({ title: 'Supprimer cette réponse type ?', message: `« ${reply.title} »`, confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/canned-replies/${reply.id}`);
      queryClient.invalidateQueries({ queryKey: ['canned-replies'] });
      toast.success('Réponse supprimée');
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <>
      <PageHeader title="Réponses types" description="Textes prêts à l’emploi pour les questions fréquentes, insérables en un clic dans une conversation."
        actions={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle réponse</Button>} />
      <div className="card">
        {replies.isError ? <div className="card-body"><ErrorBlock error={errorMessage(replies.error)} onRetry={replies.refetch} /></div> : null}
        {replies.isPending ? <Skeleton rows={3} /> : null}
        {replies.data && !replies.data.length ? (
          <EmptyState icon="send" title="Aucune réponse type" description="Gagnez du temps sur les demandes récurrentes (attestations, Wi-Fi, conventions…)."
            action={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle réponse</Button>} />
        ) : null}
        {replies.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Titre</th><th scope="col">Service</th><th scope="col" className="actions">Actions</th></tr></thead>
              <tbody>
                {replies.data.map((reply) => (
                  <tr key={reply.id}>
                    <td><strong>{reply.title}</strong><div className="cell-sub">{reply.content}</div></td>
                    <td>{reply.department ? <Badge tone="info">{reply.department.name}</Badge> : <Badge>Tous</Badge>}</td>
                    <td className="actions">
                      <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(reply)}>Modifier</Button>
                      <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${reply.title}`} onClick={() => remove(reply)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {editing ? <ReplyForm reply={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
