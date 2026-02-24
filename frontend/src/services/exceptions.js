import api from './api';

export const exceptionsService = {
  // Get all exceptions
  getAll: async (params = {}) => {
    const { skip = 0, limit = 100, status, severity, exception_type, partner_id, document_id } = params;
    const queryParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (status) queryParams.append('status', status);
    if (severity) queryParams.append('severity', severity);
    if (exception_type) queryParams.append('exception_type', exception_type);
    if (partner_id) queryParams.append('partner_id', partner_id);
    if (document_id) queryParams.append('document_id', document_id);
    
    const response = await api.get(`/exceptions/?${queryParams}`);
    return response.data;
  },

  // Get exception by ID
  getById: async (id) => {
    const response = await api.get(`/exceptions/${id}`);
    return response.data;
  },

  // Create exception
  create: async (exceptionData) => {
    const response = await api.post('/exceptions', exceptionData);
    return response.data;
  },

  // Update exception
  update: async (id, exceptionData) => {
    const response = await api.put(`/exceptions/${id}`, exceptionData);
    return response.data;
  },
};
