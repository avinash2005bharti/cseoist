import apiClient, { setAuthToken, clearAuthToken } from './client.js';

export const authApi = {
  login: async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    if (res?.data?.refreshToken) {
      localStorage.setItem('campusflow_refresh_token', res.data.refreshToken);
    }
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  refresh: async (refreshToken) => {
    const tokenToSend = refreshToken || localStorage.getItem('campusflow_refresh_token');
    const res = await apiClient.post('/auth/refresh', tokenToSend ? { refreshToken: tokenToSend } : {});
    if (res?.data?.accessToken) {
      setAuthToken(res.data.accessToken);
    }
    if (res?.data?.refreshToken) {
      localStorage.setItem('campusflow_refresh_token', res.data.refreshToken);
    }
    return res.data;
  },

  logout: async () => {
    try {
      const storedRefresh = localStorage.getItem('campusflow_refresh_token');
      await apiClient.post('/auth/logout', storedRefresh ? { refreshToken: storedRefresh } : {});
    } finally {
      clearAuthToken();
    }
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    const res = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await apiClient.patch('/auth/profile', data);
    return res.data;
  },

  sendStudentRegistrationOtp: async ({ email, name }) => {
    const res = await apiClient.post('/auth/register/student/send-otp', { email, name });
    return res.data;
  },

  verifyRegistrationOtp: async ({ email, otp }) => {
    const res = await apiClient.post('/auth/register/student/verify-otp', { email, otp });
    return res.data;
  },

  registerStudent: async (data) => {
    const res = await apiClient.post('/auth/register/student', data);
    return res.data;
  },

  registerTeacher: async (data) => {
    const res = await apiClient.post('/auth/register/teacher', data);
    return res.data;
  },

  forgotPassword: async (email) => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async ({ email, otp, newPassword }) => {
    const res = await apiClient.post('/auth/reset-password', { email, otp, newPassword });
    return res.data;
  },
};

export default authApi;
