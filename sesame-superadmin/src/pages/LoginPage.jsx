import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/api';
import { Button, TextField } from '../components/ui';

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/tickets'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.login.trim(), form.password);
      navigate(location.state?.from?.pathname || '/tickets', { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError, 'Connexion impossible'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card stack" onSubmit={submit}>
        <img src="/sesame-logo.png" alt="SESAME — School of High-Tech, AI & Management" />
        <h1>Back-office</h1>
        <p>Gestion des actualités, des étudiants et du support.</p>
        <TextField label="Identifiant" autoComplete="username" value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} required autoFocus />
        <TextField label="Mot de passe" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <Button type="submit" loading={loading}>Se connecter</Button>
      </form>
    </div>
  );
}
