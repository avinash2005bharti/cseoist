import apiClient from './client.js';

export const settingsApi = {
  getAcademicYear: async () => {
    return apiClient.get('/settings/academic-year');
  },

  setAcademicYear: async (academicYear) => {
    return apiClient.patch('/settings/academic-year', { academicYear });
  },

  getConsiderationWindow: async () => {
    return apiClient.get('/settings/consideration-window');
  },

  setConsiderationWindow: async (enabled) => {
    return apiClient.patch('/settings/consideration-window', { enabled });
  },
};

export default settingsApi;
