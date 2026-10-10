import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [categories, setCategories] = useState([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    firstname: '',
    lastname: '',
    login: '',
    password: '',
    GC: false,
    categorieId: '',
  });

  const load = async () => {
    try {
      const res = await api.get(`/users?page=${page}`);
      setUsers(res.data.content || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (e) {
      setMsg('Erreur lors du chargement des utilisateurs');
    }
  };

  useEffect(() => {
    load();
    api
      .get('/categories')
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      firstname: '',
      lastname: '',
      login: '',
      password: '',
      GC: false,
      categorieId: '',
    });
    setMsg('');
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      firstname: u.firstname || '',
      lastname: u.lastname || '',
      login: u.login || '',
      password: '',
      GC: !!u.GC,
      categorieId: u.categorieId || '',
    });
    setMsg('');
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await api.put(`/user/${editing.id}`, body);
        setMsg('Utilisateur modifié avec succès');
      } else {
        await api.post('/registeruser', form);
        setMsg('Utilisateur créé avec succès');
      }
      setShowForm(false);
      load();
    } catch (err) {
      setMsg(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Erreur lors de l\'enregistrement'
      );
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api.delete(`/user/${id}`);
      setMsg('Utilisateur supprimé');
      load();
    } catch (e) {
      setMsg('Erreur lors de la suppression');
    }
  };

  return (
    <div>
      <div style={styles.top}>
        <h2 style={styles.title}>Gestion des utilisateurs</h2>
        <button onClick={openCreate} style={styles.primaryBtn}>
          + Nouvel utilisateur
        </button>
      </div>

      {msg && <p style={styles.msg}>{msg}</p>}

      <div style={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Prénom</th>
              <th>Nom</th>
              <th>Login</th>
              <th>GC</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                  Aucun utilisateur
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.firstname}</td>
                  <td>{u.lastname}</td>
                  <td>{u.login}</td>
                  <td>{u.GC ? 'Oui' : 'Non'}</td>
                  <td>
                    <button onClick={() => openEdit(u)} style={styles.editBtn}>
                      Modifier
                    </button>
                    <button onClick={() => remove(u.id)} style={styles.delBtn}>
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button
          style={styles.pageBtn}
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          ← Préc
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-soft)' }}>
          Page {page + 1} / {totalPages}
        </span>
        <button
          style={styles.pageBtn}
          disabled={page + 1 >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Suiv →
        </button>
      </div>

      {showForm && (
        <div style={styles.overlay}>
          <form onSubmit={save} style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {editing ? 'Modifier' : 'Créer'} un utilisateur
            </h3>

            <input
              placeholder="Prénom"
              value={form.firstname}
              onChange={(e) => setForm({ ...form, firstname: e.target.value })}
              required
            />
            <input
              placeholder="Nom"
              value={form.lastname}
              onChange={(e) => setForm({ ...form, lastname: e.target.value })}
              required
            />
            <input
              placeholder="Login"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder={
                editing
                  ? 'Nouveau mot de passe (optionnel)'
                  : 'Mot de passe'
              }
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.GC}
                onChange={(e) => setForm({ ...form, GC: e.target.checked })}
              />
              GC
            </label>

            <select
              value={form.categorieId}
              onChange={(e) => setForm({ ...form, categorieId: e.target.value })}
            >
              <option value="">Catégorie (optionnel)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" style={styles.primaryBtn}>
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={styles.cancelBtn}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--primary-dark)',
    letterSpacing: '-0.02em',
  },
  primaryBtn: {
    background: 'var(--grad)',
    color: '#fff',
    padding: '11px 20px',
    borderRadius: 12,
    fontSize: 14,
    boxShadow: '0 6px 20px rgba(26,63,196,0.3)',
  },
  msg: {
    color: 'var(--primary)',
    marginBottom: 14,
    fontSize: 14,
    fontWeight: 500,
  },
  tableWrap: {
    background: 'var(--bg-card)',
    borderRadius: 18,
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  editBtn: {
    background: '#eef2ff',
    color: 'var(--primary)',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
    marginRight: 6,
  },
  delBtn: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '7px 12px',
    borderRadius: 8,
    fontSize: 12,
  },
  pagination: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  pageBtn: {
    padding: '8px 16px',
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 13,
    color: 'var(--text)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(6,12,30,0.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: 'var(--shadow-lg)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--primary-dark)',
    marginBottom: 4,
  },
  cancelBtn: {
    background: '#f1f5f9',
    color: 'var(--text-soft)',
    padding: '11px 20px',
    borderRadius: 12,
    fontSize: 14,
  },
};