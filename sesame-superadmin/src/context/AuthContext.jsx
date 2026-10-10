import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, []);

    const login = async (loginValue, password) => {
        const res = await api.post('/loginsuperAdmin', {
            login: loginValue,
            password,
        });
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        return res.data;
    };

    const logout = async () => {
        if (token) {
            try {
                await api.delete(`/logoutsuperAdmin/${token}`);
            } catch (e) {
                // ignore
            }
        }
        localStorage.removeItem('token');
        setToken(null);
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                login,
                logout,
                isAuthenticated: !!token,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);