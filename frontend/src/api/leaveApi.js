import apiClient from './client.js';

export const leaveApi = {
  create: async (data) => {
    return apiClient.post('/leaves', data);
  },

  getMine: async (params = {}) => {
    return apiClient.get('/leaves/mine', { params });
  },

  getTGQueue: async (params = {}) => {
    return apiClient.get('/leaves/tg-queue', { params });
  },

  getHODQueue: async (params = {}) => {
    return apiClient.get('/leaves/hod-queue', { params });
  },

  getTGHistory: async (params = {}) => {
    return apiClient.get('/leaves/tg-history', { params });
  },

  getAdminQueue: async (params = {}) => {
    return apiClient.get('/leaves/admin-queue', { params });
  },

  getById: async (id) => {
    return apiClient.get(`/leaves/${id}`);
  },

  cancel: async (id) => {
    return apiClient.patch(`/leaves/${id}/cancel`);
  },

  tgReview: async (id, { decision, remarks }) => {
    return apiClient.patch(`/leaves/${id}/tg-review`, { decision, remarks });
  },

  finalReview: async (id, { decision, remarks }) => {
    return apiClient.patch(`/leaves/${id}/final-review`, { decision, remarks });
  },
};

export default leaveApi;
