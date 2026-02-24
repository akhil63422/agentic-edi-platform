import api from './api';

export const analyticsService = {
  // Get dashboard analytics
  getDashboard: async (days = 7) => {
    const response = await api.get(`/analytics/dashboard/?days=${days}`);
    return response.data;
  },

  // Get trends
  getTrends: async (metric = 'documents', days = 30) => {
    const response = await api.get(`/analytics/trends/?metric=${metric}&days=${days}`);
    return response.data;
  },

  // Get partner performance
  getPartnerPerformance: async (partnerId = null, days = 30) => {
    const params = new URLSearchParams({ days: days.toString() });
    if (partnerId) params.append('partner_id', partnerId);
    
    const response = await api.get(`/analytics/partner-performance/?${params}`);
    return response.data;
  },
};
