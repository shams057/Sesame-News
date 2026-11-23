import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { useCategories, useDepartments } from '../lib/queries';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, EmptyState, ErrorBlock, Modal, PageHeader, SelectField, Skeleton, TextField, useConfirm, useToast } from '../components/ui';

function CategoryForm({ category, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const departments = useDepartments();
  const [libelle, setLibelle] = useState(category?.libelle || '');
  const [departmentId, setDepartmentId] = useState(category?.department?.id || '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const body = { libelle: libelle.trim(), departmentId: departmentId ? Number(departmentId) : null };
      return category ? api.patch(`/categories/${category.id}`, body) : api.post('/categories', body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success(category ? 'Classe modifiée' : 'Classe créée'); onClose(); },
    onError: (requestError) => setError(errorMessage(requestError)),
  });
  return (
    <Modal title={category ? 'Modifier la classe' : 'Nouvelle classe'} size="sm" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="category-form" loading={save.isPending}>Enregistrer</Button></>}>
      <form id="category-form" className="stack" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Nom de la classe" value={libelle} maxLength={100} required onChange={(event) => setLibelle(event.target.value)} placeholder="LIM (Licence Informatique Multimédia)" />
        <SelectField label="Département" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} hint="Les administrateurs de ce département gèrent les étudiants de la classe.">
          <option value="">Aucun</option>
          {departments.data?.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </SelectField>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const { isOwner } = useAuth();
  const categories = useCategories();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const remove = async (category) => {
    if (category.userCount) {
      toast.error(`« ${category.libelle} » contient ${category.userCount} étudiant(s) : changez-les de classe avant de la supprimer.`);
      return;
    }
    if (!(await confirm({ title: 'Supprimer cette classe ?', message: `« ${category.libelle} » sera supprimée.`, confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/categories/${category.id}`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Classe supprimée');
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <>
      <PageHeader
        title="Classes"
        description={isOwner ? 'Classes d’étudiants, rattachées à un département. Elles servent à cibler les actualités et déterminent quels étudiants chaque administrateur de département gère. Une classe utilisée ne peut pas être supprimée.' : 'Consultation seule : seul le super administrateur gère les classes.'}
        actions={isOwner ? <Button icon="plus" onClick={() => setEditing('new')}>Nouvelle classe</Button> : null}
      />
      <div className="card">
        {categories.isError ? <div className="card-body"><ErrorBlock error={errorMessage(categories.error)} onRetry={categories.refetch} /></div> : null}
        {categories.isPending ? <Skeleton rows={4} /> : null}
        {categories.data && !categories.data.length ? (
          <EmptyState icon="tag" title="Aucune classe" description="Créez une classe pour regrouper les étudiants et leur envoyer des actualités ciblées." action={isOwner ? <Button icon="plus" onClick={() => setEditing('new')}>Nouvelle classe</Button> : null} />
        ) : null}
        {categories.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Classe</th><th scope="col">Département</th><th scope="col">Étudiants</th><th scope="col">Créée le</th><th scope="col" className="actions">Actions</th></tr></thead>
              <tbody>
                {categories.data.map((category) => (
                  <tr key={category.id}>
                    <td><strong>{category.libelle}</strong></td>
                    <td>{category.department ? <Badge tone="info">{category.department.name}</Badge> : <span className="muted">—</span>}</td>
                    <td>{category.userCount}</td>
                    <td>{formatDate(category.createdAt)}</td>
                    <td className="actions">
                      {isOwner ? (
                        <>
                          <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(category)}>Modifier</Button>
                          <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${category.libelle}`} onClick={() => remove(category)} />
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {editing ? <CategoryForm category={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
