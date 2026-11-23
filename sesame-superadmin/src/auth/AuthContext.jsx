import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { tokenStore } from '../lib/api';

const AuthContext = createContext(null);

/**
 * The stored token is never trusted blindly: at startup it is validated
 * with GET /me, and any later 401 (expired/revoked session, disabled
 * account) logs the user out.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'checking' : 'anonymous'));

  const reset = useCallback(() => {
    tokenStore.clear();
    setAccount(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (status !== 'checking') return;
    api.get('/me')
      .then((response) => {
        if (response.data.role !== 'superadmin') throw new Error('not staff');
        setAccount(response.data);
        setStatus('authenticated');
      })
      .catch(reset);
  }, [status, reset]);

  useEffect(() => {
    window.addEventListener('sesame:unauthorized', reset);
    return () => window.removeEventListener('sesame:unauthorized', reset);
  }, [reset]);

  const login = useCallback(async (login, password) => {
    const { data } = await api.post('/auth/admin/login', { login, password });
    tokenStore.set(data.token);
    setAccount(data.account);
    setStatus('authenticated');
    return data.account;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* session already gone */ }
    reset();
  }, [reset]);

  const value = useMemo(() => ({
    account,
    status,
    isOwner: account?.adminRole === 'owner',
    login,
    logout,
    setAccount,
  }), [account, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
