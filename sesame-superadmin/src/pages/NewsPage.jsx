import { useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { errorMessage, mediaUrl, toFormData } from '../lib/api';
import { get, useCategories } from '../lib/queries';
import { cleanParams, useUrlState } from '../lib/useUrlState';
import { formatBytes, formatDate, formatDateTime, fromLocalInput, toLocalInput } from '../lib/format';
import Icon from '../components/Icon';
import { RichText } from '../lib/richText';
import {
  Badge, Button, Checkbox, EmptyState, ErrorBlock, Modal, PageHeader, Pagination, SearchInput, SelectField, Skeleton,
  TextField, useConfirm, useToast,
} from '../components/ui';

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.doc,.docx';
const MAX_FILES = 10;

const isFuture = (value) => Boolean(value) && new Date(value).getTime() > Date.now();

function newsState(news) {
  if (news.status === 'draft') return { label: 'Brouillon', tone: 'neutral' };
  if (news.expiresAt && !isFuture(news.expiresAt)) return { label: 'Expirée', tone: 'neutral' };
  if (isFuture(news.publishAt)) return { label: `Programmée · ${formatDateTime(news.publishAt)}`, tone: 'warning' };
  return { label: 'Publiée', tone: 'success' };
}

function MediaViewer({ media, onClose }) {
  const url = mediaUrl(media.url);
  return (
    <Modal title={media.originalName} onClose={onClose} size="lg" footer={<a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer" download><Icon name="download" size={16} />Télécharger</a>}>
      {media.kind === 'image' ? <img src={url} alt={media.originalName} style={{ maxHeight: '70vh', objectFit: 'contain' }} /> : null}
      {media.kind === 'video' ? <video src={url} controls style={{ maxHeight: '70vh', width: '100%' }} /> : null}
      {media.kind === 'document' && media.mimeType === 'application/pdf' ? <iframe src={url} title={media.originalName} style={{ width: '100%', height: '70vh', border: 0 }} /> : null}
      {media.kind === 'document' && media.mimeType !== 'application/pdf' ? <p className="muted">Aperçu indisponible pour ce type de document. Utilisez « Télécharger ».</p> : null}
    </Modal>
  );
}

const emptyForm = {
  titre: '', description: '', status: 'published', publishAt: '', pinned: false, audienceAll: true,
  categoryIds: [], eventStart: '', eventEnd: '', location: '', expiresAt: '',
};

function NewsForm({ news, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const categories = useCategories();
  const fileInput = useRef(null);
  const [form, setForm] = useState(() => (news ? {
    titre: news.titre,
    description: news.description,
    status: news.status,
    publishAt: toLocalInput(news.publishAt),
    pinned: news.pinned,
    audienceAll: news.audienceAll,
    categoryIds: news.categories.map((category) => category.id),
    eventStart: toLocalInput(news.eventStart),
    eventEnd: toLocalInput(news.eventEnd),
    location: news.location || '',
    expiresAt: toLocalInput(news.expiresAt),
  } : emptyForm));
  const [preview, setPreview] = useState(false);
  const [files, setFiles] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  const keptMedia = (news?.media || []).filter((media) => !removed.includes(media.id)).length;
  const addFiles = (list) => {
    const incoming = [...list];
    if (keptMedia + files.length + incoming.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} pièces jointes par actualité`);
      return;
    }
    setError('');
    setFiles((current) => [...current, ...incoming]);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = toFormData({
        titre: form.titre.trim(),
        description: form.description.trim(),
        status: form.status,
        publishAt: form.status === 'published' ? fromLocalInput(form.publishAt) : null,
        pinned: form.pinned,
        audienceAll: form.audienceAll,
        categoryIds: form.audienceAll ? [] : form.categoryIds,
        eventStart: fromLocalInput(form.eventStart),
        eventEnd: fromLocalInput(form.eventEnd),
        location: form.location.trim(),
        expiresAt: fromLocalInput(form.expiresAt),
        ...(news ? { removeMediaIds: removed } : {}),
      }, files);
      return news ? api.patch(`/news/${news.id}`, payload) : api.post('/news', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast.success(news ? 'Actualité mise à jour' : form.status === 'draft' ? 'Brouillon enregistré' : 'Actualité publiée');
      onClose();
    },
    onError: (requestError) => setError(errorMessage(requestError)),
  });

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (!form.audienceAll && !form.categoryIds.length) { setError('Choisissez au moins une catégorie ou rendez l’actualité visible par tous'); return; }
    if (form.eventEnd && !form.eventStart) { setError('Indiquez la date de début de l’événement'); return; }
    if (form.eventStart && form.eventEnd && new Date(form.eventEnd) < new Date(form.eventStart)) { setError('La fin de l’événement doit être après le début'); return; }
    save.mutate();
  };

  const toggleCategory = (id) => set({ categoryIds: form.categoryIds.includes(id) ? form.categoryIds.filter((value) => value !== id) : [...form.categoryIds, id] });

  return (
    <Modal
      title={news ? 'Modifier l’actualité' : 'Nouvelle actualité'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="news-form" loading={save.isPending}>
            {form.status === 'draft' ? 'Enregistrer le brouillon' : isFuture(form.publishAt) ? 'Programmer' : news ? 'Enregistrer' : 'Publier'}
          </Button>
        </>
      )}
    >
      <form id="news-form" className="form-grid" onSubmit={submit}>
        <TextField className="full" label="Titre" value={form.titre} maxLength={200} required onChange={(event) => set({ titre: event.target.value })} hint={`${form.titre.length}/200`} />
        <div className="full field">
          <div className="row">
            <label htmlFor="news-description">Contenu</label>
            <span className="spacer" />
            <div className="chips" role="group" aria-label="Mode d’affichage">
              <button type="button" className="chip-toggle" aria-pressed={!preview} onClick={() => setPreview(false)}>Édition</button>
              <button type="button" className="chip-toggle" aria-pressed={preview} onClick={() => setPreview(true)}>Aperçu</button>
            </div>
          </div>
          {preview ? (
            <div className="card card-body preview-box">
              <h3>{form.titre || 'Titre de l’actualité'}</h3>
              <RichText text={form.description || '…'} />
            </div>
          ) : (
            <textarea id="news-description" className="textarea" rows={8} value={form.description} maxLength={20000} required
              onChange={(event) => set({ description: event.target.value })} />
          )}
          <span className="hint">Mise en forme : **gras**, *italique*, lignes commençant par « - » pour une liste, ligne vide pour un nouveau paragraphe. Les liens https://… sont cliquables.</span>
        </div>

        <SelectField label="Statut" value={form.status} onChange={(event) => set({ status: event.target.value })}>
          <option value="published">Publiée</option>
          <option value="draft">Brouillon (invisible)</option>
        </SelectField>
        <TextField label="Publication programmée" type="datetime-local" value={form.publishAt} disabled={form.status === 'draft'}
          onChange={(event) => set({ publishAt: event.target.value })} hint="Vide = immédiatement. Les étudiants sont notifiés à la publication." />

        <TextField label="Expire le (optionnel)" type="datetime-local" value={form.expiresAt} min={form.publishAt || undefined}
          onChange={(event) => set({ expiresAt: event.target.value })} hint="Retirée automatiquement du fil après cette date." />
        <div className="field" style={{ justifyContent: 'center' }}>
          <Checkbox label="Épingler en haut du fil" checked={form.pinned} onChange={(event) => set({ pinned: event.target.checked })} />
        </div>

        <fieldset className="full stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6 }}>Audience</legend>
          <Checkbox label="Visible par tous les étudiants" checked={form.audienceAll} onChange={(event) => set({ audienceAll: event.target.checked })} />
          {!form.audienceAll ? (
            <div className="chips" role="group" aria-label="Catégories ciblées">
              {categories.data?.map((category) => (
                <button key={category.id} type="button" className="chip-toggle" aria-pressed={form.categoryIds.includes(category.id)} onClick={() => toggleCategory(category.id)}>
                  {category.libelle}
                </button>
              ))}
              {categories.data?.length === 0 ? <span className="muted small">Aucune catégorie : créez-en dans « Catégories ».</span> : null}
            </div>
          ) : null}
        </fieldset>

        <h3 className="full" style={{ marginTop: 4 }}>Événement (optionnel)</h3>
        <TextField label="Début" type="datetime-local" value={form.eventStart} onChange={(event) => set({ eventStart: event.target.value })} />
        <TextField label="Fin" type="datetime-local" value={form.eventEnd} min={form.eventStart || undefined} onChange={(event) => set({ eventEnd: event.target.value })} />
        <TextField className="full" label="Lieu" value={form.location} maxLength={200} onChange={(event) => set({ location: event.target.value })} placeholder="Amphi A, campus Ariana…" />

        <div className="full field">
          <span className="label">Pièces jointes ({keptMedia + files.length}/{MAX_FILES})</span>
          {news?.media.length || files.length ? (
            <div className="file-list">
              {news?.media.map((media) => (
                <div key={media.id} className={`file-item ${removed.includes(media.id) ? 'removed' : ''}`}>
                  <Icon name={media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'file'} size={16} />
                  <span>{media.originalName}</span>
                  <span className="muted small">{formatBytes(media.size)}</span>
                  <span className="spacer" />
                  <Button variant="ghost" size="sm" onClick={() => setRemoved((list) => (list.includes(media.id) ? list.filter((id) => id !== media.id) : [...list, media.id]))}>
                    {removed.includes(media.id) ? 'Conserver' : 'Retirer'}
                  </Button>
                </div>
              ))}
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-item">
                  <Icon name="upload" size={16} />
                  <span>{file.name}</span>
                  <span className="muted small">{formatBytes(file.size)} · nouveau</span>
                  <span className="spacer" />
                  <Button variant="ghost" size="sm" icon="x" aria-label={`Retirer ${file.name}`} onClick={() => setFiles((list) => list.filter((_, i) => i !== index))} />
                </div>
              ))}
            </div>
          ) : null}
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(event) => { event.preventDefault(); setDrag(false); addFiles(event.dataTransfer.files); }}
          >
            <Icon name="upload" size={20} />
            <div>Glissez des fichiers ou cliquez pour parcourir</div>
            <div className="small">Images, vidéos (MP4/WebM/MOV, 100 Mo max), PDF et Word</div>
          </div>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
        </div>

        {error ? <div className="full alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

function NewsCard({ news, onEdit, onDelete, onView }) {
  const state = newsState(news);
  const cover = news.media.find((media) => media.kind === 'image');
  return (
    <article className="card news-card">
      {cover ? <div className="thumb" style={{ backgroundImage: `url("${mediaUrl(cover.url)}")` }} role="img" aria-label={cover.originalName} /> : null}
      <div className="card-body">
        <div className="meta">
          <Badge tone={state.tone}>{state.label}</Badge>
          {news.pinned ? <Badge tone="teal"><Icon name="pin" size={12} />Épinglée</Badge> : null}
          {news.audienceAll ? <Badge>Tous</Badge> : news.categories.map((category) => <Badge key={category.id} tone="info">{category.libelle}</Badge>)}
        </div>
        <h3>{news.titre}</h3>
        {news.eventStart ? (
          <div className="row small" style={{ color: 'var(--navy-700)', fontWeight: 600 }}>
            <Icon name="calendar" size={14} />{formatDateTime(news.eventStart)}{news.location ? <><Icon name="mapPin" size={14} />{news.location}</> : null}
          </div>
        ) : null}
        <p className="desc">{news.description}</p>
        {news.media.length ? (
          <div className="chips">
            {news.media.map((media) => (
              <button key={media.id} type="button" className="chip-toggle" onClick={() => onView(media)} title={media.originalName}>
                <Icon name={media.kind === 'image' ? 'image' : media.kind === 'video' ? 'video' : 'file'} size={13} /> {media.originalName.length > 22 ? `${media.originalName.slice(0, 20)}…` : media.originalName}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="footer">
        <span className="muted small">{formatDate(news.createdAt)}{news.author ? ` · ${news.author.name}` : ''} · <Icon name="eye" size={12} /> {news.viewCount ?? 0} vue{news.viewCount > 1 ? 's' : ''}</span>
        <span className="spacer" />
        <Button variant="ghost" size="sm" icon="edit" onClick={() => onEdit(news)}>Modifier</Button>
        <Button variant="danger-ghost" size="sm" icon="trash" aria-label={`Supprimer « ${news.titre} »`} onClick={() => onDelete(news)} />
      </div>
    </article>
  );
}

export default function NewsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const categories = useCategories();
  const [filters, setFilters] = useUrlState({ q: '', status: '', categorieId: '', page: 0 });
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const news = useQuery({
    queryKey: ['news', filters],
    queryFn: () => get('/news', cleanParams({ ...filters, pageSize: 12 })),
    placeholderData: keepPreviousData,
  });

  const remove = async (item) => {
    if (!(await confirm({ title: 'Supprimer cette actualité ?', message: `« ${item.titre} » et ses pièces jointes seront supprimées définitivement.`, confirmLabel: 'Supprimer', danger: true }))) return;
    try {
      await api.delete(`/news/${item.id}`);
      queryClient.invalidateQueries({ queryKey: ['news'] });
      toast.success('Actualité supprimée');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader title="Actualités" description="Annonces, événements et documents publiés dans l’application étudiante." actions={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle actualité</Button>} />
      <div className="toolbar">
        <SearchInput value={filters.q} onChange={(q) => setFilters({ q })} placeholder="Titre ou contenu" label="Rechercher une actualité" />
        <select className="select" aria-label="État" value={filters.status} onChange={(event) => setFilters({ status: event.target.value })}>
          <option value="">Tous les états</option>
          <option value="published">Publiées</option>
          <option value="scheduled">Programmées</option>
          <option value="draft">Brouillons</option>
          <option value="expired">Expirées</option>
        </select>
        <select className="select" aria-label="Catégorie" value={filters.categorieId} onChange={(event) => setFilters({ categorieId: event.target.value })}>
          <option value="">Toutes les audiences</option>
          {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.libelle}</option>)}
        </select>
      </div>

      {news.isError ? <ErrorBlock error={errorMessage(news.error)} onRetry={news.refetch} /> : null}
      {news.isPending ? <Skeleton rows={3} height={120} /> : null}
      {news.data && !news.data.content.length ? (
        <div className="card">
          <EmptyState icon="news" title="Aucune actualité" description={filters.q || filters.status ? 'Aucun résultat pour ces filtres.' : 'Publiez la première annonce pour les étudiants.'}
            action={<Button icon="plus" onClick={() => setEditing('new')}>Nouvelle actualité</Button>} />
        </div>
      ) : null}
      {news.data?.content.length ? (
        <>
          <div className="grid grid-cards">
            {news.data.content.map((item) => <NewsCard key={item.id} news={item} onEdit={setEditing} onDelete={remove} onView={setViewing} />)}
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <Pagination page={filters.page} totalPages={news.data.totalPages} totalElements={news.data.totalElements} label="actualités" onChange={(page) => setFilters({ page }, { resetPage: false })} />
          </div>
        </>
      ) : null}

      {editing ? <NewsForm news={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      {viewing ? <MediaViewer media={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}
