import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { useDepartments } from '../lib/queries';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Checkbox, ErrorBlock, Modal, PageHeader, Skeleton, TextField, useConfirm, useToast } from '../components/ui';

function DepartmentForm({ department, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: department?.name || '', isActive: department?.isActive ?? true });
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => (department ? api.patch(`/departments/${department.id}`, { ...form, name: form.name.trim() }) : api.post('/departments', { ...form, name: form.name.trim() })),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); toast.success('Service enregistré'); onClose(); },
    onError: (requestError) => setError(errorMessage(requestError)),
  });
  return (
    <Modal title={department ? 'Modifier le service' : 'Nouveau service'} size="sm" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="department-form" loading={save.isPending}>Enregistrer</Button></>}>
      <form id="department-form" className="stack" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Nom" value={form.name} maxLength={120} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Checkbox label="Actif (proposé aux étudiants pour ouvrir un ticket)" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function DepartmentsPage() {
  const { isOwner } = useAuth();
  const departments = useDepartments();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const remove = async (department) => {
    if (!(await confirm({ title: 'Supprimer ce service ?', message: 'Impossible s’il a déjà reçu des tickets : désactivez-le dans ce cas.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/departments/${department.id}`);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Service supprimé');
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <>
      <PageHeader title="Services" description="Services auxquels les étudiants adressent leurs tickets. Un agent rattaché à un service ne voit que sa file."
        actions={isOwner ? <Button icon="plus" onClick={() => setEditing('new')}>Nouveau service</Button> : null} />
      {!isOwner ? <div className="alert alert-info" style={{ marginBottom: 16 }}>Seul le super administrateur peut modifier les services.</div> : null}
      <div className="card">
        {departments.isError ? <div className="card-body"><ErrorBlock error={errorMessage(departments.error)} onRetry={departments.refetch} /></div> : null}
        {departments.isPending ? <Skeleton rows={6} /> : null}
        {departments.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Service</th><th scope="col">État</th>{isOwner ? <th scope="col" className="actions">Actions</th> : null}</tr></thead>
              <tbody>
                {departments.data.map((department) => (
                  <tr key={department.id}>
                    <td><strong>{department.name}</strong></td>
                    <td>{department.isActive ? <Badge tone="success">Actif</Badge> : <Badge>Inactif</Badge>}</td>
                    {isOwner ? (
                      <td className="actions">
                        <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(department)}>Modifier</Button>
                        <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${department.name}`} onClick={() => remove(department)} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {editing ? <DepartmentForm department={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
