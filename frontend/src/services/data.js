import api from './api';

export const dataService = {
  exportData: async () => {
    const response = await api.get('/data/export/');
    return response.data;
  },

  importData: async (payload) => {
    const response = await api.post('/data/import/', payload);
    return response.data;
  },
};
