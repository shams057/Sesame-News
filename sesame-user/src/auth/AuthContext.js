import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { setAuthToken, setUnauthorizedHandler } from '../api/client';
import { tokenStorage } from './tokenStorage';
import { unregisterPushToken } from '../notifications/push';
import { clearCache } from '../utils/offlineCache';

const AuthContext = createContext(null);

/**
 * The stored token is validated with GET /me at startup; any later 401
 * (expired, revoked, account disabled) signs the student out.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('checking');

  const reset = useCallback(async () => {
    setAuthToken(null);
    await tokenStorage.clear();
    await clearCache();
    queryClient.clear();
    setAccount(null);
    setStatus('anonymous');
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => { reset(); });
    let cancelled = false;
    (async () => {
      const token = await tokenStorage.get();
      if (!token) { if (!cancelled) setStatus('anonymous'); return; }
      setAuthToken(token);
      try {
        const { data } = await api.get('/me');
        if (data.role !== 'user') throw new Error('not a student');
        if (!cancelled) { setAccount(data); setStatus('authenticated'); }
      } catch (error) {
        // Offline at startup: keep the session, screens show cached data.
        if (!error.response && !cancelled) { setAccount({ offline: true }); setStatus('authenticated'); return; }
        if (!cancelled) reset();
      }
    })();
    return () => { cancelled = true; };
  }, [reset]);

  const login = useCallback(async (login, password) => {
    const { data } = await api.post('/auth/user/login', { login, password });
    setAuthToken(data.token);
    await tokenStorage.set(data.token);
    setAccount(data.account);
    setStatus('authenticated');
    return data.account;
  }, []);

  const logout = useCallback(async () => {
    await unregisterPushToken().catch(() => {});
    try { await api.post('/auth/logout'); } catch { /* session already gone */ }
    await reset();
  }, [reset]);

  const refreshAccount = useCallback(async () => {
    const { data } = await api.get('/me');
    setAccount(data);
    return data;
  }, []);

  const value = useMemo(() => ({ account, status, login, logout, refreshAccount, setAccount }), [account, status, login, logout, refreshAccount]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
