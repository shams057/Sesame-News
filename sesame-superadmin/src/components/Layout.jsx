import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import Icon from './Icon';
import { Button, Modal, TextField, useConfirm, useToast } from './ui';

function ProfileModal({ onClose }) {
  const { account, setAccount } = useAuth();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(account.displayName || '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (passwords.newPassword && passwords.newPassword !== passwords.confirm) {
      setError('Les deux nouveaux mots de passe ne correspondent pas');
      return;
    }
    setSaving(true);
    try {
      if (displayName.trim() && displayName.trim() !== account.displayName) {
        const { data } = await api.patch('/me', { displayName: displayName.trim() });
        setAccount(data);
      }
      if (passwords.newPassword) {
        await api.put('/me/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      }
      toast.success('Profil mis à jour');
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Mon profil"
      onClose={onClose}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="profile-form" loading={saving}>Enregistrer</Button>
        </>
      )}
    >
      <form id="profile-form" className="stack" onSubmit={save}>
        <p className="muted small">Identifiant : <strong>{account.login}</strong> · {account.adminRole === 'owner' ? 'Super administrateur' : 'Administrateur de service'}{account.department ? ` · ${account.department.name}` : ''}</p>
        <TextField label="Nom affiché" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} required />
        <h3>Changer le mot de passe</h3>
        <TextField label="Mot de passe actuel" type="password" autoComplete="current-password" value={passwords.currentPassword}
          onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required={Boolean(passwords.newPassword)} />
        <TextField label="Nouveau mot de passe" type="password" autoComplete="new-password" minLength={8} hint="8 caractères minimum. Vos autres sessions seront déconnectées."
          value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
        <TextField label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" value={passwords.confirm}
          onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { account, isOwner, logout } = useAuth();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const unread = useQuery({ queryKey: ['unread'], queryFn: () => api.get('/tickets/unread').then((response) => response.data) });

  const link = (to, icon, label, extra) => (
    <NavLink to={to} className="nav-link" onClick={() => setOpen(false)}>
      <Icon name={icon} />
      <span>{label}</span>
      {extra}
    </NavLink>
  );

  const onLogout = async () => {
    if (await confirm({ title: 'Se déconnecter ?', message: 'Vous devrez saisir à nouveau vos identifiants.', confirmLabel: 'Se déconnecter' })) logout();
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigation principale">
        <div className="sidebar-brand">
          <img src="/sesame-mark-white.png" alt="" />
          <div>
            <strong>SESAME</strong>
            <span>Back-office</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Support</div>
          {link('/tickets', 'ticket', 'Tickets', unread.data?.count ? <span className="count" aria-label={`${unread.data.count} non lus`}>{unread.data.count}</span> : null)}
          {link('/canned-replies', 'send', 'Réponses types')}
          {link('/stats', 'chart', 'Statistiques')}
          <div className="sidebar-section">Communication</div>
          {link('/news', 'news', 'Actualités')}
          <div className="sidebar-section">Annuaire</div>
          {link('/users', 'users', 'Étudiants')}
          {link('/categories', 'tag', 'Classes')}
          {link('/departments', 'building', 'Services')}
          {link('/admins', 'shield', isOwner ? 'Équipe & accès' : 'Équipe')}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{account.displayName || account.login}</strong>
            {account.department ? account.department.name : isOwner ? 'Super administrateur' : 'Administrateur de service'}
          </div>
          <button type="button" className="nav-link" onClick={() => setProfileOpen(true)}><Icon name="user" /><span>Mon profil</span></button>
          <button type="button" className="nav-link" onClick={onLogout}><Icon name="logout" /><span>Déconnexion</span></button>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <main className="main">
        <div className="topbar">
          <button type="button" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={22} /></button>
          <img src="/sesame-logo-white.png" alt="SESAME" />
        </div>
        <Outlet />
      </main>
      {profileOpen ? <ProfileModal onClose={() => setProfileOpen(false)} /> : null}
    </div>
  );
}
