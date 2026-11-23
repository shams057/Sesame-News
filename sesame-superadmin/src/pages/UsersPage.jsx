import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { downloadFile, errorMessage } from '../lib/api';
import { get, useCategories } from '../lib/queries';
import { cleanParams, useUrlState } from '../lib/useUrlState';
import { formatRelative } from '../lib/format';
import {
  Badge, Button, EmptyState, ErrorBlock, Modal, PageHeader, Pagination, SearchInput, SecretValue,
  SelectField, Skeleton, TextField, useConfirm, useToast,
} from '../components/ui';

function UserForm({ user, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const categories = useCategories();
  const [form, setForm] = useState({
    firstname: user?.firstname || '',
    lastname: user?.lastname || '',
    login: user?.login || '',
    email: user?.email || '',
    categorieId: user?.categorie?.id || '',
  });
  const [error, setError] = useState('');
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, firstname: form.firstname.trim(), lastname: form.lastname.trim(), login: form.login.trim(), email: form.email.trim(), categorieId: form.categorieId ? Number(form.categorieId) : null };
      return user ? api.patch(`/users/${user.id}`, body) : api.post('/users', body);
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (user) { toast.success('Étudiant mis à jour'); onClose(); } else onCreated(data);
    },
    onError: (requestError) => setError(errorMessage(requestError)),
  });

  return (
    <Modal
      title={user ? 'Modifier l’étudiant' : 'Nouvel étudiant'}
      onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" form="user-form" loading={save.isPending}>Enregistrer</Button></>}
    >
      <form id="user-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate(); }}>
        <TextField label="Prénom" value={form.firstname} maxLength={100} required onChange={(event) => set({ firstname: event.target.value })} />
        <TextField label="Nom" value={form.lastname} maxLength={100} required onChange={(event) => set({ lastname: event.target.value })} />
        <TextField label="Identifiant de connexion" value={form.login} maxLength={100} minLength={3} required pattern="[\w.@\-]+" title="Lettres, chiffres, . _ - @"
          autoComplete="off" onChange={(event) => set({ login: event.target.value })} />
        <TextField label="E-mail (optionnel)" type="email" value={form.email} maxLength={255} onChange={(event) => set({ email: event.target.value })} />
        <SelectField label="Catégorie" value={form.categorieId} onChange={(event) => set({ categorieId: event.target.value })} hint="Détermine les actualités ciblées qu’il reçoit.">
          <option value="">Aucune</option>
          {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.libelle}</option>)}
        </SelectField>
        {!user ? <p className="full muted small">Un mot de passe temporaire sera généré ; l’étudiant devra le changer à sa première connexion.</p> : null}
        {error ? <div className="full alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

function TemporaryPasswordModal({ title, login, password, onClose }) {
  return (
    <Modal title={title} onClose={onClose} size="sm" footer={<Button onClick={onClose}>J’ai noté le mot de passe</Button>}>
      <p>Mot de passe temporaire de <strong>{login}</strong> :</p>
      <SecretValue value={password} />
      <div className="alert alert-warning">Il ne sera plus affiché. Transmettez-le à l’étudiant ; il devra le changer à sa première connexion.</div>
    </Modal>
  );
}

function credentialsCsv(credentials) {
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = credentials.map((row) => [row.login, row.firstname, row.lastname, row.temporaryPassword].map(escape).join(','));
  return `﻿login,prenom,nom,mot_de_passe_temporaire\n${lines.join('\n')}\n`;
}

function ImportModal({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const pick = async (selected) => {
    setFile(selected);
    setResult(null);
    setError('');
    if (!selected) { setPreview([]); return; }
    const text = await selected.text();
    setPreview(text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(0, 6));
  };

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/users/import', form).then((response) => response.data);
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (requestError) => setError(errorMessage(requestError)),
  });

  const downloadCredentials = () => {
    const blob = new Blob([credentialsCsv(result.credentials)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `identifiants_import_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Modal
      title="Importer des étudiants (CSV)"
      size="lg"
      onClose={onClose}
      footer={result
        ? <Button onClick={onClose}>Terminer</Button>
        : <><Button variant="secondary" onClick={onClose}>Annuler</Button><Button icon="upload" disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}>Importer</Button></>}
    >
      {!result ? (
        <>
          <p>Colonnes attendues (ligne d’en-tête) : <code>firstname, lastname, login, email, categorie</code>. Séparateur <code>,</code> ou <code>;</code>. <code>email</code> et <code>categorie</code> (libellé) sont optionnels.</p>
          <div className="row">
            <Button variant="secondary" icon="download" onClick={() => downloadFile('/users/import/template', 'modele.csv').catch((e) => toast.error(errorMessage(e)))}>Télécharger le modèle</Button>
            <label className="btn btn-secondary" htmlFor="csv-file">Choisir un fichier</label>
            <input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => pick(event.target.files?.[0] || null)} />
            {file ? <span className="muted">{file.name}</span> : null}
          </div>
          <div className="alert alert-info">Aucun mot de passe n’est lu dans le fichier : chaque étudiant reçoit un mot de passe temporaire à changer à la première connexion. Les lignes invalides sont ignorées et listées ; les lignes valides sont importées en une seule fois.</div>
          {preview.length ? (
            <div>
              <h3>Aperçu</h3>
              <pre className="mono small" style={{ background: 'var(--surface-muted)', padding: 10, borderRadius: 6, overflowX: 'auto' }}>{preview.join('\n')}</pre>
            </div>
          ) : null}
          {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        </>
      ) : (
        <>
          <div className={`alert ${result.imported ? 'alert-success' : 'alert-warning'}`}>{result.imported} étudiant(s) importé(s), {result.errors.length} ligne(s) ignorée(s).</div>
          {result.imported ? (
            <div className="alert alert-warning row">
              <span>Les mots de passe temporaires ne seront plus affichés : téléchargez-les maintenant.</span>
              <Button size="sm" icon="download" onClick={downloadCredentials}>Identifiants (CSV)</Button>
            </div>
          ) : null}
          {result.errors.length ? (
            <div className="table-wrap card">
              <table className="table">
                <thead><tr><th>Ligne</th><th>Login</th><th>Problème</th></tr></thead>
                <tbody>{result.errors.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.login || '—'}</td><td>{row.error}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const categories = useCategories();
  const [filters, setFilters] = useUrlState({ q: '', categorieId: '', status: '', sort: 'name', page: 0 });
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [secret, setSecret] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const users = useQuery({ queryKey: ['users', filters], queryFn: () => get('/users', cleanParams({ ...filters, pageSize: 25 })), placeholderData: keepPreviousData });

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['users'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); };

  const toggleActive = async (user) => {
    const activate = !user.isActive;
    if (!activate && !(await confirm({ title: `Désactiver ${user.firstname} ${user.lastname} ?`, message: 'L’étudiant sera déconnecté et ne pourra plus se connecter. Ses tickets sont conservés.', confirmLabel: 'Désactiver' }))) return;
    try {
      await api.patch(`/users/${user.id}`, { isActive: activate });
      toast.success(activate ? 'Compte réactivé' : 'Compte désactivé');
      refresh();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const resetPassword = async (user) => {
    if (!(await confirm({ title: 'Réinitialiser le mot de passe ?', message: `Un mot de passe temporaire sera généré pour ${user.login} et ses sessions seront fermées.`, confirmLabel: 'Réinitialiser' }))) return;
    try {
      const { data } = await api.post(`/users/${user.id}/reset-password`);
      setSecret({ title: 'Mot de passe réinitialisé', login: user.login, password: data.temporaryPassword });
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const remove = async (user) => {
    if (!(await confirm({ title: 'Supprimer définitivement ce compte ?', message: 'Préférez la désactivation. La suppression est irréversible ; ses tickets restent dans l’historique sans propriétaire.', confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Compte supprimé');
      refresh();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const pageIds = users.data?.content.map((user) => user.id) || [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current);
    pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    return next;
  });

  const bulk = async (action) => {
    const ids = [...selected];
    if (action === 'deactivate' && !(await confirm({ title: `Désactiver ${ids.length} compte(s) ?`, message: 'Ils seront déconnectés immédiatement.', confirmLabel: 'Désactiver' }))) return;
    try {
      const { data } = await api.post('/users/bulk', { ids, action, ...(action === 'setCategory' ? { categorieId: bulkCategory ? Number(bulkCategory) : null } : {}) });
      toast.success(`${data.updated} compte(s) mis à jour`);
      setSelected(new Set());
      refresh();
    } catch (error) { toast.error(errorMessage(error)); }
  };

  const sortHeader = (key, label) => (
    <button type="button" className="sort" onClick={() => setFilters({ sort: key })} aria-pressed={filters.sort === key}>{label}{filters.sort === key ? ' ↓' : ''}</button>
  );

  return (
    <>
      <PageHeader
        title="Étudiants"
        description="Comptes de l’application étudiante."
        actions={<><Button variant="secondary" icon="upload" onClick={() => setImporting(true)}>Importer un CSV</Button><Button icon="plus" onClick={() => setEditing('new')}>Nouvel étudiant</Button></>}
      />
      <div className="toolbar">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder="Nom, login ou e-mail" label="Rechercher un étudiant" />
        <select className="select" aria-label="Catégorie" value={filters.categorieId} onChange={(event) => setFilters({ categorieId: event.target.value })}>
          <option value="">Toutes les catégories</option>
          {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.libelle}</option>)}
        </select>
        <select className="select" aria-label="État du compte" value={filters.status} onChange={(event) => setFilters({ status: event.target.value })}>
          <option value="">Tous les comptes</option>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
        </select>
      </div>
      <div className="card">
        {users.isError ? <div className="card-body"><ErrorBlock error={errorMessage(users.error)} onRetry={users.refetch} /></div> : null}
        {users.isPending ? <Skeleton rows={8} /> : null}
        {users.data && !users.data.content.length ? (
          <EmptyState icon="users" title="Aucun étudiant" description="Aucun compte ne correspond à ces filtres." action={<Button icon="plus" onClick={() => setEditing('new')}>Nouvel étudiant</Button>} />
        ) : null}
        {selected.size ? (
          <div className="bulk-bar" role="region" aria-label="Actions groupées">
            <strong>{selected.size} sélectionné(s)</strong>
            <Button variant="secondary" size="sm" icon="check" onClick={() => bulk('activate')}>Activer</Button>
            <Button variant="secondary" size="sm" icon="lock" onClick={() => bulk('deactivate')}>Désactiver</Button>
            <select className="select" aria-label="Catégorie à appliquer" value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
              <option value="">Aucune catégorie</option>
              {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.libelle}</option>)}
            </select>
            <Button variant="secondary" size="sm" onClick={() => bulk('setCategory')}>Appliquer la catégorie</Button>
            <span className="spacer" />
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Tout désélectionner</Button>
          </div>
        ) : null}
        {users.data?.content.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col"><input type="checkbox" aria-label="Sélectionner toute la page" checked={allSelected} onChange={toggleAll} /></th>
                  <th scope="col">{sortHeader('name', 'Nom')}</th>
                  <th scope="col">{sortHeader('login', 'Login')}</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col">État</th>
                  <th scope="col">{sortHeader('-lastLoginAt', 'Dernière connexion')}</th>
                  <th scope="col" className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data.content.map((user) => (
                  <tr key={user.id}>
                    <td><input type="checkbox" aria-label={`Sélectionner ${user.login}`} checked={selected.has(user.id)} onChange={() => toggle(user.id)} /></td>
                    <td><strong>{user.lastname}</strong> {user.firstname}{user.email ? <div className="cell-sub">{user.email}</div> : null}</td>
                    <td className="mono">{user.login}</td>
                    <td>{user.categorie ? <Badge tone="info">{user.categorie.libelle}</Badge> : <span className="muted">—</span>}</td>
                    <td>
                      {user.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Désactivé</Badge>}
                      {user.mustChangePassword ? <> <Badge tone="warning" title="Mot de passe temporaire non changé">MDP temporaire</Badge></> : null}
                    </td>
                    <td>{user.lastLoginAt ? formatRelative(user.lastLoginAt) : <span className="muted">Jamais</span>}</td>
                    <td className="actions">
                      <Button variant="ghost" size="sm" icon="edit" aria-label={`Modifier ${user.login}`} onClick={() => setEditing(user)} />
                      <Button variant="ghost" size="sm" icon="key" aria-label={`Réinitialiser le mot de passe de ${user.login}`} title="Réinitialiser le mot de passe" onClick={() => resetPassword(user)} />
                      <Button variant="ghost" size="sm" icon={user.isActive ? 'lock' : 'check'} aria-label={user.isActive ? `Désactiver ${user.login}` : `Réactiver ${user.login}`} title={user.isActive ? 'Désactiver' : 'Réactiver'} onClick={() => toggleActive(user)} />
                      <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer ${user.login}`} title="Supprimer" onClick={() => remove(user)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {users.data ? <Pagination page={filters.page} totalPages={users.data.totalPages} totalElements={users.data.totalElements} label="étudiants" onChange={(page) => setFilters({ page }, { resetPage: false })} /> : null}
      </div>

      {editing ? (
        <UserForm
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(data) => { setEditing(null); setSecret({ title: 'Étudiant créé', login: data.user.login, password: data.temporaryPassword }); }}
        />
      ) : null}
      {importing ? <ImportModal onClose={() => setImporting(false)} /> : null}
      {secret ? <TemporaryPasswordModal {...secret} onClose={() => setSecret(null)} /> : null}
    </>
  );
}
