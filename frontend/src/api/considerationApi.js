import apiClient from './client.js';

export const considerationApi = {
  create: async (data) => {
    return apiClient.post('/considerations', data);
  },

  getMine: async (params = {}) => {
    return apiClient.get('/considerations/mine', { params });
  },

  getTGQueue: async (params = {}) => {
    return apiClient.get('/considerations/tg-queue', { params });
  },

  getHODQueue: async (params = {}) => {
    return apiClient.get('/considerations/hod-queue', { params });
  },

  getTeacherApproved: async (params = {}) => {
    return apiClient.get('/considerations/teacher-approved', { params });
  },

  getTGHistory: async (params = {}) => {
    return apiClient.get('/considerations/tg-history', { params });
  },

  getById: async (id) => {
    return apiClient.get(`/considerations/${id}`);
  },

  cancel: async (id) => {
    return apiClient.patch(`/considerations/${id}/cancel`);
  },

  tgReview: async (id, { decision, remarks }) => {
    return apiClient.patch(`/considerations/${id}/tg-review`, { decision, remarks });
  },

  hodReview: async (id, { decision, remarks, approvedPeriods }) => {
    return apiClient.patch(`/considerations/${id}/final-review`, {
      decision,
      remarks,
      approvedPeriods,
    });
  },

  auditStudent: async (id, { studentId, status, remarks }) => {
    return apiClient.patch(`/considerations/${id}/audit-student`, {
      studentId,
      status,
      remarks,
    });
  },

  auditAllStudents: async (id, { status = 'VERIFIED', remarks } = {}) => {
    return apiClient.patch(`/considerations/${id}/audit-all`, {
      status,
      remarks,
    });
  },
};

export default considerationApi;
