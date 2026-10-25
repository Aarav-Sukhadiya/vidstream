import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import AuthContext from './authContext';
import api, { setAccessToken, setSessionExpiredHandler } from '../api/client';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((userData, token) => {
    setUser(userData);
    setTokenState(token);
    setAccessToken(token);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setTokenState(null);
    setAccessToken(null);
  }, []);

  // Restore session on initial load via /auth/refresh
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearAuth();
    });

    let isMounted = true;

    async function restoreSession() {
      try {
        const response = await api.post('/auth/refresh');
        if (isMounted && response.data) {
          applyAuth(response.data.user, response.data.accessToken);
        }
      } catch {
        if (isMounted) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [applyAuth, clearAuth]);

  const login = useCallback(
    async (email, password) => {
      const response = await api.post('/auth/login', { email, password });
      applyAuth(response.data.user, response.data.accessToken);
      return response.data.user;
    },
    [applyAuth]
  );

  const register = useCallback(
    async (formData) => {
      const response = await api.post('/auth/register', formData);
      applyAuth(response.data.user, response.data.accessToken);
      return response.data.user;
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, accessToken, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthProvider;
