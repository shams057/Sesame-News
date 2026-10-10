import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getSuperAdminId } from '../utils/token';
import api from '../api/axios';

const NAV_ITEMS = [
  {
    key: 'news',
    label: 'Actualités',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
  {
    key: 'users',
    label: 'Gestion Utilisateurs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'ticket-stats',
    label: 'Statistiques Tickets',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    key: 'tickets',
    label: 'Historique Tickets',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 5H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
        <path d="M15 5V3a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v2" />
        <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },
];

export default function Sidebar({ active, onChange, collapsed, onToggle }) {
  const [showProfile, setShowProfile] = useState(false);
  const [form, setForm] = useState({ login: '', password: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const id = getSuperAdminId();
    if (!id) { setMsg("Impossible de récupérer votre identifiant"); return; }
    if (!form.login && !form.password) { setMsg('Remplissez au moins un champ'); return; }
    setLoading(true);
    setMsg('');
    try {
      const body = {};
      if (form.login) body.login = form.login;
      if (form.password) body.password = form.password;
      await api.put(`/superAdmin/${id}`, body);
      setMsg('Profil mis à jour avec succès');
      setTimeout(() => setShowProfile(false), 1200);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <aside style={{ ...s.sidebar, width: collapsed ? 68 : 244 }}>
        {/* Logo area */}
        <div style={{ ...s.logoArea, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <img
            src="https://universitesesame.com/assets/Logo-SESAME-Bn110qrZ.png"
            alt="SESAME"
            style={{ height: 28, filter: 'brightness(0) invert(1)', flexShrink: 0 }}
          />
          {!collapsed && (
            <div>
              <div style={s.logoTitle}>SuperAdmin</div>
              <div style={s.logoSub}>Université SESAME</div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button onClick={onToggle} style={s.collapseBtn} title={collapsed ? 'Développer' : 'Réduire'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed
              ? <><polyline points="9 18 15 12 9 6" /></>
              : <><polyline points="15 18 9 12 15 6" /></>
            }
          </svg>
        </button>

        {/* Navigation */}
        <nav style={s.nav}>
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                style={{
                  ...s.navItem,
                  ...(isActive ? s.navItemActive : {}),
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  paddingLeft: collapsed ? 0 : 14,
                }}
                title={collapsed ? item.label : ''}
              >
                <span style={{ ...s.navIcon, color: isActive ? '#60a5fa' : 'rgba(255,255,255,0.45)' }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{ ...s.navLabel, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                    {item.label}
                  </span>
                )}
                {isActive && !collapsed && <span style={s.activePip} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{ ...s.bottomActions, alignItems: collapsed ? 'center' : 'stretch' }}>
          <button
            onClick={() => { setForm({ login: '', password: '' }); setMsg(''); setShowProfile(true); }}
            style={{ ...s.bottomBtn, justifyContent: collapsed ? 'center' : 'flex-start' }}
            title="Mon profil"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            {!collapsed && <span>Mon profil</span>}
          </button>
          <button
            onClick={handleLogout}
            style={{ ...s.bottomBtn, justifyContent: collapsed ? 'center' : 'flex-start' }}
            title="Déconnexion"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Profile Modal */}
      {showProfile && (
        <div style={s.overlay} onClick={() => setShowProfile(false)}>
          <form onSubmit={saveProfile} style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalAvatarWrap}>
              <div style={s.modalAvatar}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a56db" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            </div>
            <h3 style={s.modalTitle}>Mon profil</h3>
            <p style={s.modalSub}>Modifier votre login ou mot de passe</p>

            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Nouveau login</label>
              <input
                placeholder="Laisser vide pour ne pas changer"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>Nouveau mot de passe</label>
              <input
                type="password"
                placeholder="Laisser vide pour ne pas changer"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {msg && (
              <div style={{
                ...s.alertBox,
                background: msg.includes('succès') ? '#f0fdf4' : '#fef2f2',
                color: msg.includes('succès') ? '#15803d' : '#b91c1c',
                border: `1px solid ${msg.includes('succès') ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" style={s.primaryBtn} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => setShowProfile(false)} style={s.cancelBtn}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const s = {
  sidebar: {
    height: '100vh',
    background: '#0d1b4b',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
    zIndex: 30,
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoArea: {
    padding: '22px 18px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    minHeight: 72,
  },
  logoTitle: { color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.2 },
  logoSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  collapseBtn: {
    alignSelf: 'flex-end',
    margin: '10px 12px',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  nav: {
    flex: 1,
    padding: '6px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '11px 0',
    paddingRight: 12,
    borderRadius: 9,
    background: 'transparent',
    fontSize: 13.5,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
    position: 'relative',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    width: '100%',
    textAlign: 'left',
  },
  navItemActive: {
    background: 'rgba(59,130,246,0.18)',
  },
  navIcon: { flexShrink: 0, display: 'flex', alignItems: 'center', width: 44, justifyContent: 'center' },
  navLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' },
  activePip: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#60a5fa',
    flexShrink: 0,
    marginRight: 4,
  },
  bottomActions: {
    padding: '10px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  bottomBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    borderRadius: 8,
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    width: '100%',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
  },
  modalAvatarWrap: { display: 'flex', justifyContent: 'center', marginBottom: 4 },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#111827', textAlign: 'center', marginTop: -8 },
  modalSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: -8 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12.5, fontWeight: 600, color: '#374151', letterSpacing: '0.01em' },
  alertBox: { fontSize: 13, padding: '10px 14px', borderRadius: 8 },
  primaryBtn: {
    flex: 1,
    background: '#1a56db',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#F3F4F6',
    color: '#6B7280',
    padding: '12px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
};
