import axios from 'axios';

let currentToken = localStorage.getItem('campusflow_token') || null;

const apiBaseUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_BACKEND_URL
    ? `${import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '')}/api/v1`
    : '/api/v1');

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // sends httpOnly refresh cookie
});

// Request interceptor to attach JWT
apiClient.interceptors.request.use(
  (config) => {
    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for automatic token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response.data, // unwraps { success, data, meta }
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error.response?.data?.error || error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const newToken = res.data?.data?.accessToken;
        if (newToken) {
          setAuthToken(newToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthToken();
        window.dispatchEvent(new CustomEvent('campusflow_auth_expired'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const errorPayload = error.response?.data?.error || {
      message: error.message || 'Network request failed',
      code: 'NETWORK_ERROR',
    };
    return Promise.reject(errorPayload);
  }
);

export const getAuthToken = () => currentToken;

export const setAuthToken = (token) => {
  currentToken = token;
  if (token) {
    localStorage.setItem('campusflow_token', token);
  } else {
    localStorage.removeItem('campusflow_token');
  }
};

export const clearAuthToken = () => {
  currentToken = null;
  localStorage.removeItem('campusflow_token');
  localStorage.removeItem('campusflow_user');
  localStorage.removeItem('campusflow_role');
  localStorage.removeItem('campusflow_hod_rejected_ids');
  try {
    sessionStorage.clear();
  } catch {}
};

export default apiClient;
