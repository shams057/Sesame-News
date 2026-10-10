import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { getSuperAdminId } from '../utils/token';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
const PDF_EXT   = ['.pdf'];

function getExt(path) {
  if (!path) return '';
  return path.toLowerCase().split('?')[0];
}
function isImage(path) { return IMAGE_EXT.some((e) => getExt(path).endsWith(e)); }
function isVideo(path) { return VIDEO_EXT.some((e) => getExt(path).endsWith(e)); }
function isPdf(path)   { return PDF_EXT.some((e) => getExt(path).endsWith(e)); }

function fileUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `http://localhost:3000${path.startsWith('/') ? '' : '/'}${path}`;
}

/* ─── In-app media viewer ──────────────────────────────────────────────── */
function MediaModal({ path, onClose }) {
  const url = fileUrl(path);
  if (!url) return null;

  return (
    <div style={s.mediaOverlay} onClick={onClose}>
      <button style={s.mediaClose} onClick={onClose} title="Fermer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div style={s.mediaContent} onClick={(e) => e.stopPropagation()}>
        {isImage(path) && (
          <img src={url} alt="Pièce jointe" style={s.mediaImg} />
        )}
        {isVideo(path) && (
          <video src={url} controls autoPlay style={s.mediaVideo} />
        )}
        {isPdf(path) && (
          <iframe src={url} title="Document PDF" style={s.mediaPdf} />
        )}
        {!isImage(path) && !isVideo(path) && !isPdf(path) && (
          <div style={s.mediaFallback}>
            <p style={{ color: '#fff', marginBottom: 16, fontSize: 15 }}>
              Ce type de fichier ne peut pas être prévisualisé.
            </p>
            <a href={url} target="_blank" rel="noopener noreferrer" style={s.mediaDownload}>
              Télécharger le fichier
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main NewsPage ────────────────────────────────────────────────────── */
export default function NewsPage() {
  const [news, setNews]           = useState([]);
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [categories, setCategories] = useState([]);
  const [msg, setMsg]             = useState('');
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [viewPath, setViewPath]   = useState(null); // path currently previewed
  const [form, setForm]           = useState({ titre: '', description: '', all: true, categorieId: '' });

  const load = async () => {
    try {
      const res = await api.get(`/newssall?page=${page}`);
      setNews(res.data.content || []);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      setMsg('Erreur lors du chargement des actualités');
    }
  };

  useEffect(() => {
    load();
    api.get('/categories')
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [page]);

  const getCategorieLibelle = (id) => {
    if (!id) return '—';
    const cat = categories.find((c) => c.id === id || c.id === Number(id));
    return cat ? cat.libelle : `Catégorie #${id}`;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ titre: '', description: '', all: true, categorieId: '' });
    setFile(null);
    setMsg('');
    setShowForm(true);
  };

  const openEdit = (n) => {
    setEditing(n);
    setForm({ titre: n.titre || '', description: n.description || '', all: !!n.all, categorieId: n.categorieId || '' });
    setFile(null);
    setMsg('');
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    if (!form.titre.trim() || !form.description.trim()) { setMsg('Titre et description sont obligatoires'); return; }
    if (!form.all && !form.categorieId) { setMsg('Veuillez choisir une catégorie'); return; }

    const superAdminId = getSuperAdminId();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('titre', form.titre.trim());
      formData.append('description', form.description.trim());
      formData.append('all', form.all ? 'true' : 'false');
      formData.append('superAdminId', superAdminId ? String(superAdminId) : '');
      formData.append('userId', '');
      formData.append('categorieId', !form.all && form.categorieId ? String(form.categorieId) : '');
      if (file) formData.append('file', file);

      if (editing) {
        await api.put(`/news/${editing.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMsg('Actualité modifiée avec succès');
      } else {
        await api.post('/createnews', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMsg('Actualité créée avec succès');
      }
      setShowForm(false);
      setFile(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.error || err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer cette actualité ?')) return;
    try {
      await api.delete(`/news/${id}`);
      setMsg('Actualité supprimée');
      load();
    } catch {
      setMsg('Erreur lors de la suppression');
    }
  };

  return (
    <div>
      {/* Header row */}
      <div style={s.topBar}>
        {msg && !showForm && (
          <span style={{ fontSize: 13, color: msg.includes('supprim') || msg.includes('Erreur') ? 'var(--danger)' : 'var(--success)', fontWeight: 500 }}>
            {msg}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={openCreate} style={s.primaryBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouvelle actualité
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {news.length === 0 ? (
        <div style={s.emptyState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
            <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
          </svg>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucune actualité pour le moment</p>
        </div>
      ) : (
        <div style={s.grid}>
          {news.map((n) => (
            <div key={n.id} style={s.card}>
              {/* Category badge */}
              <div style={s.cardMeta}>
                <span style={s.badge}>{n.all ? 'Tous' : getCategorieLibelle(n.categorieId)}</span>
                <span style={s.cardDate}>
                  {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <h3 style={s.cardTitle}>{n.titre}</h3>
              <p style={s.cardDesc}>
                {n.description?.slice(0, 130)}{n.description?.length > 130 ? '…' : ''}
              </p>

              {/* Attachment preview */}
              {n.path && (
                <button onClick={() => setViewPath(n.path)} style={s.attachBtn}>
                  {isImage(n.path) ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  ) : isVideo(n.path) ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  )}
                  Voir la pièce jointe
                </button>
              )}

              <div style={s.cardActions}>
                <button onClick={() => openEdit(n)} style={s.editBtn}>Modifier</button>
                <button onClick={() => remove(n.id)} style={s.delBtn}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={page === 0} onClick={() => setPage(page - 1)}>← Préc</button>
          <span style={s.pageInfo}>Page {page + 1} / {totalPages}</span>
          <button style={s.pageBtn} disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Suiv →</button>
        </div>
      )}

      {/* In-app media viewer */}
      {viewPath && <MediaModal path={viewPath} onClose={() => setViewPath(null)} />}

      {/* Form modal */}
      {showForm && (
        <div style={s.overlay} onClick={() => { setShowForm(false); setMsg(''); }}>
          <form onSubmit={save} style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>{editing ? 'Modifier' : 'Créer'} une actualité</h3>
              <button type="button" onClick={() => { setShowForm(false); setMsg(''); }} style={s.closeBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Titre *</label>
              <input placeholder="Titre de l'actualité" value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })} required />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Description *</label>
              <textarea placeholder="Contenu de l'actualité…" rows={5} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>

            <label style={s.checkLabel}>
              <input type="checkbox" checked={form.all}
                onChange={(e) => setForm({ ...form, all: e.target.checked, categorieId: e.target.checked ? '' : form.categorieId })} />
              <span>Visible par tous les utilisateurs</span>
            </label>

            {!form.all && (
              <div style={s.fieldGroup}>
                <label style={s.label}>Catégorie cible *</label>
                <select value={form.categorieId} onChange={(e) => setForm({ ...form, categorieId: e.target.value })} required>
                  <option value="">Choisir une catégorie</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                </select>
              </div>
            )}

            <div style={s.fieldGroup}>
              <label style={s.label}>
                Pièce jointe{editing ? ' (laisser vide pour conserver l\'actuelle)' : ''}
              </label>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ padding: '8px 12px' }} />
              {file && <p style={s.fileName}>Sélectionné : {file.name}</p>}
              {editing?.path && !file && (
                <p style={s.fileCurrent}>
                  Fichier actuel :{' '}
                  <button type="button" onClick={() => setViewPath(editing.path)} style={s.viewCurrentBtn}>
                    Prévisualiser
                  </button>
                </p>
              )}
            </div>

            {msg && (
              <div style={{
                ...s.alertBox,
                background: msg.includes('succès') ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: msg.includes('succès') ? 'var(--success)' : 'var(--danger)',
              }}>
                {msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" style={s.primaryBtn} disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setMsg(''); }} style={s.cancelBtn}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const s = {
  topBar: { display: 'flex', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'var(--primary)', color: '#fff',
    padding: '10px 18px', borderRadius: 'var(--radius-sm)', fontSize: 13.5,
    boxShadow: '0 1px 3px rgba(26,86,219,0.25)',
  },
  emptyState: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '64px 40px',
    textAlign: 'center',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    padding: 22, border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: 'var(--shadow-sm)',
    transition: 'box-shadow 0.15s',
  },
  cardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 600,
    padding: '3px 9px', borderRadius: 99,
    background: '#EFF6FF', color: 'var(--primary)',
    border: '1px solid #DBEAFE',
  },
  cardDate: { fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 },
  cardDesc: { fontSize: 13.5, color: 'var(--text-soft)', lineHeight: 1.55, flex: 1 },
  attachBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#F3F4F6', color: 'var(--text-soft)',
    padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
    border: '1px solid var(--border)',
    cursor: 'pointer', alignSelf: 'flex-start',
  },
  cardActions: { display: 'flex', gap: 8, marginTop: 4 },
  editBtn: {
    flex: 1, background: '#EFF6FF', color: 'var(--primary)',
    padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
  },
  delBtn: {
    flex: 1, background: 'var(--danger-bg)', color: 'var(--danger)',
    padding: '8px 12px', borderRadius: 8, fontSize: 12.5,
  },
  pagination: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  pageBtn: {
    padding: '8px 16px', background: 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text)',
  },
  pageInfo: { fontSize: 13, color: 'var(--text-muted)' },
  // Media viewer
  mediaOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 24,
  },
  mediaClose: {
    position: 'absolute', top: 16, right: 16,
    background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
    width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 201,
  },
  mediaContent: {
    maxWidth: '90vw', maxHeight: '90vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mediaImg: { maxWidth: '88vw', maxHeight: '88vh', borderRadius: 8, objectFit: 'contain' },
  mediaVideo: { maxWidth: '88vw', maxHeight: '88vh', borderRadius: 8 },
  mediaPdf: { width: '80vw', height: '85vh', border: 'none', borderRadius: 8, background: '#fff' },
  mediaFallback: { textAlign: 'center' },
  mediaDownload: {
    display: 'inline-block', background: 'var(--primary)', color: '#fff',
    padding: '12px 24px', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 14,
  },
  // Form
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: {
    background: '#fff', borderRadius: 'var(--radius-lg)', padding: '28px 28px',
    width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: 'var(--shadow-lg)', maxHeight: '92vh', overflowY: 'auto',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: 700, color: 'var(--text)' },
  closeBtn: {
    width: 32, height: 32, background: '#F3F4F6', border: 'none', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-soft)',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12.5, fontWeight: 600, color: '#374151', letterSpacing: '0.01em' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' },
  fileName: { fontSize: 12, color: 'var(--secondary)', marginTop: 5 },
  fileCurrent: { fontSize: 12, color: 'var(--text-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 },
  viewCurrentBtn: {
    background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600,
    fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline',
  },
  alertBox: { fontSize: 13, padding: '10px 14px', borderRadius: 8 },
  cancelBtn: {
    background: '#F3F4F6', color: 'var(--text-soft)', padding: '10px 20px',
    borderRadius: 8, fontSize: 14, fontWeight: 600,
  },
};