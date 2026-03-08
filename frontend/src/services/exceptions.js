import api from './api';
import { localDataStore } from '@/store/localDataStore';

export const exceptionsService = {
  // Get all exceptions (uses localStorage when imported data exists, unless forceApi=true)
  getAll: async (params = {}) => {
    const { forceApi, ...rest } = params;
    if (!forceApi) {
      const data = localDataStore.getData();
      if (data && data.exceptions?.length > 0) {
        return localDataStore.filterExceptions(data.exceptions, {
          skip: rest.skip ?? 0,
          limit: rest.limit ?? 100,
          status: rest.status,
          severity: rest.severity,
          exception_type: rest.exception_type,
          partner_id: rest.partner_id,
          document_id: rest.document_id,
        });
      }
    }
    const { skip = 0, limit = 100, status, severity, exception_type, partner_id, document_id } = rest;
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
    const data = localDataStore.getData();
    if (data) {
      const found = data.exceptions.find(
        (e) => String(e._id) === String(id) || String(e.id) === String(id)
      );
      if (found) return found;
    }
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
