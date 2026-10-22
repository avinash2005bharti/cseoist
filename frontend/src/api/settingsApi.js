import apiClient from './client.js';

export const settingsApi = {
  getConsiderationWindow: async () => {
    return apiClient.get('/settings/consideration-window');
  },

  setConsiderationWindow: async (enabled) => {
    return apiClient.patch('/settings/consideration-window', { enabled });
  },
};

export default settingsApi;
