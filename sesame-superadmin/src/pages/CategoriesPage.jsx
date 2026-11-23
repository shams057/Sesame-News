import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { useCategories } from '../lib/queries';
import { formatDate } from '../lib/format';
import { Button, EmptyState, ErrorBlock, Modal, PageHeader, Skeleton, TextField, useConfirm, useToast } from '../components/ui';

function CategoryForm({ category, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [libelle, setLibelle] = useState(category?.libelle || '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => (category ? api.patch(`/categories/${category.id}`, { libelle: libelle.trim() }) : api.post('/categories', { libelle: libelle.trim() })),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); toast.success(category ? 'Catégorie renommée' : 'Catégorie créée'); onClose(); },
    onError: (requestError) => setError(errorMessage(requestError)),
  });
  return (
    <Modal title={category ? 'Renommer la catégorie' : 'Nouvelle catégorie'} size="sm" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="category-form" loading={save.isPending}>Enregistrer</Button></>}>
      <form id="category-form" className="stack" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Libellé" value={libelle} maxLength={100} required onChange={(event) => setLibelle(event.target.value)} placeholder="Licence Informatique 2ᵉ année" />
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const categories = useCategories();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);

  const remove = async (category) => {
    if (category.userCount) {
      toast.error(`« ${category.libelle} » contient ${category.userCount} étudiant(s) : réaffectez-les avant de supprimer la catégorie.`);
      return;
    }
    if (!(await confirm({ title: 'Supprimer cette catégorie ?', message: `« ${category.libelle} » sera supprimée.`, confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/categories/${category.id}`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Catégorie supprimée');
    } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <>
      <PageHeader title="Catégories" description="Groupes d’étudiants (filière, niveau…) utilisés pour cibler les actualités. Une catégorie utilisée ne peut pas être supprimée."
        actions={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle catégorie</Button>} />
      <div className="card">
        {categories.isError ? <div className="card-body"><ErrorBlock error={errorMessage(categories.error)} onRetry={categories.refetch} /></div> : null}
        {categories.isPending ? <Skeleton rows={4} /> : null}
        {categories.data && !categories.data.length ? (
          <EmptyState icon="tag" title="Aucune catégorie" description="Créez une catégorie pour regrouper les étudiants et leur envoyer des actualités ciblées." action={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle catégorie</Button>} />
        ) : null}
        {categories.data?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Libellé</th><th scope="col">Étudiants</th><th scope="col">Créée le</th><th scope="col" className="actions">Actions</th></tr></thead>
              <tbody>
                {categories.data.map((category) => (
                  <tr key={category.id}>
                    <td><strong>{category.libelle}</strong></td>
                    <td>{category.userCount}</td>
                    <td>{formatDate(category.createdAt)}</td>
                    <td className="actions">
                      <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(category)}>Renommer</Button>
                      <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${category.libelle}`} onClick={() => remove(category)} />
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
