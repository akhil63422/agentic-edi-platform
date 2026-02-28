import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout (cloud cold start can be slow)
});

// Load runtime config (config.json) - cache-bust to avoid stale localhost config
const configReady = fetch(`/config.json?t=${Date.now()}`)
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (c?.backendUrl) {
      const url = c.backendUrl;
      if (url.startsWith('/')) {
        api.defaults.baseURL = url;
      } else if (typeof window !== 'undefined' && url.startsWith('http')) {
        try {
          const configHost = new URL(url).hostname;
          const currentHost = window.location.hostname;
          if (configHost !== currentHost && /trycloudflare\.com|ngrok|localhost|127\.0\.0\.1/.test(currentHost)) {
            api.defaults.baseURL = window.location.origin + '/api/v1';
          } else {
            api.defaults.baseURL = url;
          }
        } catch {
          api.defaults.baseURL = window.location.origin + '/api/v1';
        }
      } else {
        api.defaults.baseURL = url;
      }
    }
  })
  .catch(() => {
    if (typeof window !== 'undefined') api.defaults.baseURL = window.location.origin + '/api/v1';
  });

// Ensure config is loaded before first request (config.json overrides build-time URL)
api.interceptors.request.use(
  async (config) => {
    await configReady;
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      // Don't redirect - let the app handle authentication
      // The app will continue to work without authentication for now
    }
    return Promise.reject(error);
  }
);

export default api;
