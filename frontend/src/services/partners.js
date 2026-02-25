import api from './api';
import { localDataStore } from '@/store/localDataStore';

export const partnersService = {
  // Get all partners (uses localStorage when imported data exists)
  getAll: async (params = {}) => {
    const data = localDataStore.getData();
    // Use local data only if it has partners; otherwise fetch from API
    if (data && data.trading_partners?.length > 0) {
      return localDataStore.filterPartners(data.trading_partners, {
        skip: params.skip ?? 0,
        limit: params.limit ?? 100,
        status: params.status,
        search: params.search,
      });
    }
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
    const data = localDataStore.getData();
    if (data) {
      const found = data.trading_partners.find(
        (p) => String(p._id) === String(id) || String(p.id) === String(id)
      );
      if (found) return found;
    }
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
