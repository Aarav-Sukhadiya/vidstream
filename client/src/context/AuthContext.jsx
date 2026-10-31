import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import AuthContext from './authContext';
import api, { setAccessToken, setSessionExpiredHandler, refreshSession } from '../api/client';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((userData, token) => {
    setAccessToken(token);
    setUser(userData);
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  // Restore the session from the refresh cookie on first load
  useEffect(() => {
    setSessionExpiredHandler(clearAuth);
    let isMounted = true;

    refreshSession()
      .then((data) => {
        if (isMounted) applyAuth(data.user, data.accessToken);
      })
      .catch(() => {
        if (isMounted) clearAuth();
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [applyAuth, clearAuth]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      applyAuth(data.user, data.accessToken);
      return data.user;
    },
    [applyAuth]
  );

  const register = useCallback(
    async (formData) => {
      const { data } = await api.post('/auth/register', formData);
      applyAuth(data.user, data.accessToken);
      return data.user;
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
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthProvider;
