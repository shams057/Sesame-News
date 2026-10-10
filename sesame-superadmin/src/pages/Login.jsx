import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [loginValue, setLoginValue] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(loginValue, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Identifiants incorrects');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={s.page}>
            <div style={s.blob1} />
            <div style={s.blob2} />

            <div style={s.card}>
                <div style={s.logoWrap}>
                    <img
                        src="https://universitesesame.com/assets/Logo-SESAME-Bn110qrZ.png"
                        alt="SESAME"
                        style={{ height: 100 }}
                    />
                </div>

                <p style={s.tagline}>Construire le Futur Digital</p>
                <h1 style={s.title}>Espace SuperAdmin</h1>
                <p style={s.subtitle}>
                    Connectez-vous pour gérer les utilisateurs et les actualités
                </p>

                <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
                    <div style={s.field}>
                        <label style={s.label}>Login</label>
                        <input
                            value={loginValue}
                            onChange={(e) => setLoginValue(e.target.value)}
                            placeholder="votre.login"
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Mot de passe</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    {error && <div style={s.errorBox}>{error}</div>}

                    <button type="submit" style={s.btn} disabled={loading}>
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span style={s.spinner} />
                                Connexion...
                            </span>
                        ) : (
                            'Se connecter'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

const s = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--grad-dark)',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
    },
    blob1: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'rgba(0,200,255,0.15)',
        filter: 'blur(80px)',
        top: -100,
        right: -100,
    },
    blob2: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'rgba(26,63,196,0.3)',
        filter: 'blur(60px)',
        bottom: -50,
        left: -50,
    },
    card: {
        position: 'relative',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        padding: '44px 40px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.2)',
    },
    logoWrap: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 12,
    },
    tagline: {
        textAlign: 'center',
        color: 'var(--secondary)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
    },
    title: {
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--primary-dark)',
        marginTop: 8,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-soft)',
        marginTop: 6,
    },
    field: { marginBottom: 18 },
    label: {
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 6,
    },
    errorBox: {
        background: '#fef2f2',
        color: '#dc2626',
        fontSize: 13,
        padding: '10px 14px',
        borderRadius: 10,
        marginBottom: 16,
        border: '1px solid #fecaca',
    },
    btn: {
        width: '100%',
        padding: '14px',
        background: 'var(--grad)',
        color: '#fff',
        fontSize: 15,
        borderRadius: 12,
        marginTop: 8,
        boxShadow: '0 8px 24px rgba(26,63,196,0.35)',
    },
    spinner: {
        width: 16,
        height: 16,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
    },
};