import { useState, useEffect } from 'react';
import api from '../api/axios';

const DEPARTMENTS = ['Finance', 'IT', 'RH', 'Pédagogie', 'Administration', 'Direction', 'Autre'];

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters & Pagination
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: 'IT',
    status: 'open',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // View Detail Modal
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page };
      if (filterStatus) params.status = filterStatus;
      if (filterDept) params.department = filterDept;

      const res = await api.get('/tickets', { params });
      setTickets(res.data.content || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalElements(res.data.totalElements || 0);
    } catch (err) {
      console.error('Fetch tickets error:', err);
      setError('Impossible de charger l\'historique des tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [page, filterStatus, filterDept]);

  const handleOpenCreate = () => {
    setEditingTicket(null);
    setFormData({ title: '', description: '', department: 'IT', status: 'open' });
    setModalError('');
    setShowModal(true);
  };

  const handleOpenEdit = (t) => {
    setEditingTicket(t);
    setFormData({
      title: t.title || '',
      description: t.description || '',
      department: t.department || 'IT',
      status: t.status || 'open',
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setModalError('Le titre est requis.');
      return;
    }
    setSubmitting(true);
    setModalError('');

    try {
      if (editingTicket) {
        await api.put(`/ticket/${editingTicket.id}`, formData);
      } else {
        await api.post('/createticket', {
          ...formData,
          openedAt: new Date(),
        });
      }
      setShowModal(false);
      fetchTickets();
    } catch (err) {
      console.error('Save ticket error:', err);
      setModalError(err.response?.data?.error || 'Erreur lors de l\'enregistrement du ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (ticket) => {
    const newStatus = ticket.status === 'open' ? 'closed' : 'open';
    try {
      await api.put(`/ticket/${ticket.id}`, {
        status: newStatus,
        closedAt: newStatus === 'closed' ? new Date() : null,
      });
      fetchTickets();
    } catch (err) {
      console.error('Toggle status error:', err);
      alert('Erreur lors du changement de statut.');
    }
  };

  const handleDeleteTicket = async (id) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce ticket ?')) return;
    try {
      await api.delete(`/ticket/${id}`);
      fetchTickets();
    } catch (err) {
      console.error('Delete ticket error:', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={s.wrap}>
      {/* Header & Controls */}
      <div style={s.topBar}>
        <div>
          <h2 style={s.title}>Historique des Tickets</h2>
          <p style={s.sub}>Consultation et gestion de l'ensemble des tickets ({totalElements} tickets au total)</p>
        </div>

        <button onClick={handleOpenCreate} style={s.addBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Créer un ticket
        </button>
      </div>

      {/* Filter Bar */}
      <div style={s.filterBar}>
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Statut:</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
            style={s.selectInput}
          >
            <option value="">Tous les statuts</option>
            <option value="open">Ouverts</option>
            <option value="closed">Fermés</option>
          </select>
        </div>

        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Département:</label>
          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(0); }}
            style={s.selectInput}
          >
            <option value="">Tous les départements</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Notice */}
      {error && <div style={s.errorBanner}>{error}</div>}

      {/* Table Container */}
      <div style={s.tableCard}>
        {loading ? (
          <div style={s.emptyState}>Chargement des tickets...</div>
        ) : tickets.length === 0 ? (
          <div style={s.emptyState}>Aucun ticket trouvé.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr style={s.thRow}>
                <th style={s.th}>ID</th>
                <th style={s.th}>Titre / Description</th>
                <th style={s.th}>Département</th>
                <th style={s.th}>Statut</th>
                <th style={s.th}>Ouvert le</th>
                <th style={s.th}>Fermé le</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} style={s.tr}>
                  <td style={{ ...s.td, color: '#6B7280', fontSize: 13 }}>#{t.id}</td>
                  <td style={s.td}>
                    <div
                      style={s.ticketTitle}
                      onClick={() => setSelectedTicket(t)}
                      title="Cliquer pour voir le détail"
                    >
                      {t.title}
                    </div>
                    {t.description && (
                      <div style={s.ticketDescSnippet}>
                        {t.description.length > 60 ? `${t.description.slice(0, 60)}...` : t.description}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>
                    <span style={s.deptBadge}>{t.department}</span>
                  </td>
                  <td style={s.td}>
                    <span
                      onClick={() => handleToggleStatus(t)}
                      style={{
                        ...s.statusBadge,
                        background: t.status === 'open' ? '#ECFDF5' : '#F3F4F6',
                        color: t.status === 'open' ? '#059669' : '#6B7280',
                        border: `1px solid ${t.status === 'open' ? '#A7F3D0' : '#E5E7EB'}`,
                        cursor: 'pointer',
                      }}
                      title="Cliquer pour changer le statut"
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: t.status === 'open' ? '#10B981' : '#9CA3AF',
                        }}
                      />
                      {t.status === 'open' ? 'Ouvert' : 'Fermé'}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: 13, color: '#374151' }}>
                    {formatDate(t.openedAt || t.createdAt)}
                  </td>
                  <td style={{ ...s.td, fontSize: 13, color: '#6B7280' }}>
                    {t.status === 'closed' ? formatDate(t.closedAt) : '—'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setSelectedTicket(t)}
                        style={s.iconBtn}
                        title="Voir détail"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(t)}
                        style={s.iconBtn}
                        title="Modifier"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTicket(t.id)}
                        style={{ ...s.iconBtn, color: '#EF4444' }}
                        title="Supprimer"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={s.pagination}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              style={{ ...s.pageBtn, opacity: page === 0 ? 0.5 : 1 }}
            >
              Précédent
            </button>
            <span style={s.pageInfo}>
              Page {page + 1} sur {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              style={{ ...s.pageBtn, opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <form onSubmit={handleSaveTicket} style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>{editingTicket ? 'Modifier le ticket' : 'Nouveau ticket'}</h3>

            <div style={s.fieldGroup}>
              <label style={s.label}>Titre *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Problème d'accès Wi-Fi"
                style={s.input}
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Département *</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                style={s.input}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                style={s.input}
              >
                <option value="open">Ouvert</option>
                <option value="closed">Fermé</option>
              </select>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails du problème ou de la demande..."
                style={{ ...s.input, resize: 'vertical' }}
              />
            </div>

            {modalError && <div style={s.modalErrorBox}>{modalError}</div>}

            <div style={s.modalActions}>
              <button type="button" onClick={() => setShowModal(false)} style={s.cancelBtn}>
                Annuler
              </button>
              <button type="submit" disabled={submitting} style={s.submitBtn}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Detail Modal */}
      {selectedTicket && (
        <div style={s.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Ticket #{selectedTicket.id}</span>
                <h3 style={{ ...s.modalTitle, textAlign: 'left', marginTop: 2 }}>{selectedTicket.title}</h3>
              </div>
              <span
                style={{
                  ...s.statusBadge,
                  background: selectedTicket.status === 'open' ? '#ECFDF5' : '#F3F4F6',
                  color: selectedTicket.status === 'open' ? '#059669' : '#6B7280',
                  border: `1px solid ${selectedTicket.status === 'open' ? '#A7F3D0' : '#E5E7EB'}`,
                }}
              >
                {selectedTicket.status === 'open' ? 'Ouvert' : 'Fermé'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0 16px', background: '#F9FAFB', padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Département</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 2 }}>{selectedTicket.department}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Date d'ouverture</span>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{formatDate(selectedTicket.openedAt || selectedTicket.createdAt)}</div>
              </div>
              {selectedTicket.closedAt && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 700 }}>Date de fermeture</span>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{formatDate(selectedTicket.closedAt)}</div>
                </div>
              )}
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <div style={{ fontSize: 14, color: '#1F2937', whiteSpace: 'pre-wrap', background: '#FFFFFF', border: '1px solid #E5E7EB', padding: 12, borderRadius: 8, minHeight: 80 }}>
                {selectedTicket.description || 'Aucune description fournie.'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setSelectedTicket(null)} style={s.submitBtn}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { paddingBottom: 40 },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 14, color: '#6B7280' },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#1a56db',
    color: '#fff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  filterBar: {
    display: 'flex',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
    background: '#fff',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid #E5E7EB',
  },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  filterLabel: { fontSize: 13, fontWeight: 600, color: '#374151' },
  selectInput: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #D1D5DB',
    fontSize: 13,
    color: '#111827',
    background: '#fff',
    outline: 'none',
  },
  tableCard: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  thRow: { background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' },
  th: { padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' },
  tr: { borderBottom: '1px solid #F3F4F6' },
  td: { padding: '14px 16px', fontSize: 14, color: '#111827', verticalAlign: 'middle' },
  ticketTitle: { fontWeight: 600, color: '#111827', cursor: 'pointer', marginBottom: 2 },
  ticketDescSnippet: { fontSize: 12.5, color: '#6B7280' },
  deptBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    background: '#F3F4F6',
    color: '#374151',
    border: '1px solid #E5E7EB',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    userSelect: 'none',
  },
  iconBtn: {
    background: 'transparent',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    padding: '6px',
    color: '#4B5563',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 14 },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderTop: '1px solid #E5E7EB',
    background: '#F9FAFB',
  },
  pageBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #D1D5DB',
    background: '#fff',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    cursor: 'pointer',
  },
  pageInfo: { fontSize: 13, color: '#6B7280' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #D1D5DB',
    fontSize: 14,
    color: '#111827',
    outline: 'none',
  },
  modalErrorBox: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: 10, borderRadius: 8, fontSize: 13 },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  cancelBtn: { padding: '9px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  submitBtn: { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#1a56db', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  errorBanner: { padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: 8, marginBottom: 16, fontSize: 13.5 },
};
