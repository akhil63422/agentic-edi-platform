import api from './api';

export const partnersService = {
  // Get all partners
  getAll: async (params = {}) => {
    const { skip = 0, limit = 100, status, search } = params;
    const queryParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (status) queryParams.append('status', status);
    if (search) queryParams.append('search', search);
    
    const response = await api.get(`/partners/?${queryParams}`);
    return response.data;
  },

  // Get partner by ID
  getById: async (id) => {
    const response = await api.get(`/partners/${id}`);
    return response.data;
  },

  // Create partner
  create: async (partnerData) => {
    const response = await api.post('/partners/', partnerData);
    return response.data;
  },

  // Update partner
  update: async (id, partnerData) => {
    const response = await api.put(`/partners/${id}`, partnerData);
    return response.data;
  },

  // Delete partner
  delete: async (id) => {
    await api.delete(`/partners/${id}`);
  },
};
