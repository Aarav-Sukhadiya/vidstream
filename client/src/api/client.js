import axios from 'axios';

let inMemoryToken = null;
let refreshPromise = null;
let onSessionExpiredCallback = null;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function setAccessToken(token) {
  inMemoryToken = token;
}

export function getAccessToken() {
  return inMemoryToken;
}

export function setSessionExpiredHandler(callback) {
  onSessionExpiredCallback = callback;
}

/**
 * Exchange the refresh cookie for a new access token. Concurrent callers share a
 * single in-flight request: refresh tokens are single-use, so sending the same
 * cookie twice would trip the server's token-reuse detection.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', null, { _skipAuthRefresh: true })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

// On 401, refresh once and replay the original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = /\/auth\/(login|register|refresh)$/.test(original?.url || '');

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original._skipAuthRefresh ||
      isAuthEndpoint ||
      !inMemoryToken
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const { accessToken } = await refreshSession();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshErr) {
      setAccessToken(null);
      onSessionExpiredCallback?.();
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
