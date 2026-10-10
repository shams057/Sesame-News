import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser = await AsyncStorage.getItem('user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

const login = async (loginValue, password) => {
  const res = await api.post('/loginuser', {
    login: loginValue,
    password,
  });

  const receivedToken = res.data.token;
  const receivedUser = res.data.user;

  if (!receivedToken || !receivedUser?.id) {
    throw new Error('Réponse login invalide');
  }

  const userData = {
    id: receivedUser.id,
    firstname: receivedUser.firstname,
    lastname: receivedUser.lastname,
    login: receivedUser.login,
    categorieId: receivedUser.categorieId,
  };

  await AsyncStorage.setItem('token', receivedToken);
  await AsyncStorage.setItem('user', JSON.stringify(userData));

  setToken(receivedToken);
  setUser(userData);

  return userData;
};

  const logout = async () => {
    try {
      if (token) {
        await api.delete(`/logoutuser/${token}`);
      }
    } catch (e) {
      // ignore
    }
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);