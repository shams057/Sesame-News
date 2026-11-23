import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { useAdmins, useCategories, useDepartments } from '../lib/queries';
import { formatRelative } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Checkbox, ErrorBlock, Modal, PageHeader, SelectField, Skeleton, TextField, useConfirm, useToast } from '../components/ui';

function AdminForm({ admin, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const departments = useDepartments();
  const categories = useCategories();
  const [form, setForm] = useState({
    login: admin?.login || '',
    displayName: admin?.displayName || '',
    password: '',
    role: admin?.role || 'agent',
    departmentId: admin?.department?.id || '',
    isActive: admin?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, login: form.login.trim(), displayName: form.displayName.trim(), departmentId: form.departmentId ? Number(form.departmentId) : null };
      if (!body.password) delete body.password;
      return admin ? api.patch(`/admins/${admin.id}`, body) : api.post('/admins', body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admins'] }); toast.success('Compte enregistré'); onClose(); },
    onError: (requestError) => setError(errorMessage(requestError)),
  });
  return (
    <Modal title={admin ? 'Modifier le compte' : 'Nouveau membre de l’équipe'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="admin-form" loading={save.isPending}>Enregistrer</Button></>}>
      <form id="admin-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Identifiant" value={form.login} required minLength={3} maxLength={60} pattern="[\w.@\-]+" autoComplete="off" onChange={(event) => set({ login: event.target.value })} />
        <TextField label="Nom affiché" value={form.displayName} required maxLength={100} onChange={(event) => set({ displayName: event.target.value })} hint="Visible par les étudiants dans les réponses." />
        <TextField className="full" label={admin ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} type="password" autoComplete="new-password" minLength={8} required={!admin}
          value={form.password} onChange={(event) => set({ password: event.target.value })} hint="8 caractères minimum. Le changer déconnecte ses sessions." />
        <SelectField label="Rôle" value={form.role} onChange={(event) => set({ role: event.target.value })} hint="Super administrateur : toutes les actions. Administrateur de service : uniquement ce qui concerne son service.">
          <option value="agent">Administrateur de service</option>
          <option value="owner">Super administrateur</option>
        </SelectField>
        <SelectField label="Service" value={form.departmentId} onChange={(event) => set({ departmentId: event.target.value })} hint="Restreint la file de tickets à ce service.">
          <option value="">Tous les services</option>
          {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </SelectField>
        {form.role === 'agent' ? (
          <p className="full muted small">
            Classes gérées : {(categories.data || []).filter((c) => c.department?.id === Number(form.departmentId)).map((c) => c.libelle).join(', ') || 'aucune (ce service ne gère pas d’étudiants)'}.
            Les classes sont rattachées aux départements dans « Classes ».
          </p>
        ) : null}
        {admin ? <div className="full"><Checkbox label="Compte actif" checked={form.isActive} onChange={(event) => set({ isActive: event.target.checked })} /></div> : null}
        {error ? <div className="full alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function AdminsPage() {
  const categories = useCategories();
  const { account, isOwner } = useAuth();
  const admins = useAdmins();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const remove = async (admin) => {
    if (!(await confirm({ title: 'Supprimer ce compte ?', message: `${admin.displayName || admin.login} perdra l’accès immédiatement. Ses tickets seront désassignés.`, confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/admins/${admin.id}`);
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Compte supprimé');
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <>
      <PageHeader title={isOwner ? 'Équipe & accès' : 'Équipe'} description="Comptes du back-office."
        actions={isOwner ? <Button icon="plus" onClick={() => setEditing('new')}>Ajouter un membre</Button> : null} />
      <div className="card">
        {admins.isError ? <div className="card-body"><ErrorBlock error={errorMessage(admins.error)} onRetry={admins.refetch} /></div> : null}
        {admins.isPending ? <Skeleton rows={4} /> : null}
        {admins.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Nom</th><th scope="col">Identifiant</th><th scope="col">Rôle</th><th scope="col">Service</th><th scope="col">Classes gérées</th><th scope="col">Dernière connexion</th>{isOwner ? <th scope="col" className="actions">Actions</th> : null}</tr>
              </thead>
              <tbody>
                {admins.data.map((admin) => (
                  <tr key={admin.id}>
                    <td><strong>{admin.displayName || admin.login}</strong>{admin.id === account.id ? <span className="muted"> (vous)</span> : null}{!admin.isActive ? <> <Badge tone="danger">Désactivé</Badge></> : null}</td>
                    <td className="mono">{admin.login}</td>
                    <td>{admin.role === 'owner' ? <Badge tone="info">Super admin</Badge> : <Badge>Admin de service</Badge>}</td>
                    <td>{admin.department?.name || <span className="muted">Tous</span>}</td>
                    <td>{admin.role === 'owner' ? <span className="muted">Tous</span> : (categories.data || []).filter((c) => admin.department && c.department?.id === admin.department.id).map((c) => c.libelle.split(' (')[0]).join(', ') || <span className="muted">—</span>}</td>
                    <td>{admin.lastLoginAt ? formatRelative(admin.lastLoginAt) : <span className="muted">Jamais</span>}</td>
                    {isOwner ? (
                      <td className="actions">
                        <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(admin)}>Modifier</Button>
                        {admin.id !== account.id ? <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${admin.login}`} onClick={() => remove(admin)} /> : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {editing ? <AdminForm admin={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
