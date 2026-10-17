import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getStoredToken, setStoredToken } from '../services/api';
import logError from '../utils/logError';

// eslint-disable-next-line react/only-export-components
export const AuthContext = createContext(null);

// eslint-disable-next-line react/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(() => !!getStoredToken());

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api.get('/me')
      .then((response) => {
        if (!cancelled) setUser(response.data.user);
      })
      .catch((error) => {
        logError('auth:me', error);
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, clearSession]);

  const login = async (credentials) => {
    try {
      const response = await api.post('/login', credentials);
      const { access_token, user: userData } = response.data;
      setStoredToken(access_token);
      setUser(userData);
      setToken(access_token);
      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors?.email?.[0] || error.response?.data?.message || 'Error de autenticación',
      };
    }
  };

  const register = async (credentials) => {
    try {
      const response = await api.post('/register', credentials);
      const { access_token, user: userData } = response.data;
      setStoredToken(access_token);
      setUser(userData);
      setToken(access_token);
      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error de registro',
      };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await api.post('/logout');
      } catch (e) {
        logError('auth:logout', e);
      }
    }
    clearSession();
  };

  const updateProfile = async (formData) => {
    try {
      const response = await api.post('/me/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(response.data.user);
      return { success: true, user: response.data.user };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error al actualizar perfil',
        errors: error.response?.data?.errors || null,
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
