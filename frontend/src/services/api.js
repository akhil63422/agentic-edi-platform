import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Load runtime config (config.json) - allows changing backend URL without rebuild
const configReady = fetch('/config.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (c?.backendUrl) api.defaults.baseURL = c.backendUrl;
  })
  .catch(() => {});

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
