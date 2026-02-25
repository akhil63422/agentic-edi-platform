import api from './api';
import { localDataStore } from '@/store/localDataStore';

export const documentsService = {
  // Get all documents (uses localStorage when imported data exists)
  getAll: async (params = {}) => {
    const data = localDataStore.getData();
    if (data && data.documents?.length > 0) {
      return localDataStore.filterDocuments(data.documents, {
        skip: params.skip ?? 0,
        limit: params.limit ?? 100,
        direction: params.direction,
        status: params.status,
        partner_id: params.partner_id,
        document_type: params.document_type,
      });
    }
    const { skip = 0, limit = 100, direction, status, partner_id, document_type } = params;
    const queryParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (direction) queryParams.append('direction', direction);
    if (status) queryParams.append('status', status);
    if (partner_id) queryParams.append('partner_id', partner_id);
    if (document_type) queryParams.append('document_type', document_type);
    const response = await api.get(`/documents/?${queryParams}`);
    return response.data;
  },

  // Get document by ID
  getById: async (id) => {
    const data = localDataStore.getData();
    if (data) {
      const found = data.documents.find(
        (d) => String(d._id) === String(id) || String(d.id) === String(id)
      );
      if (found) return found;
    }
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  // Create document
  create: async (documentData) => {
    const response = await api.post('/documents', documentData);
    return response.data;
  },

  // Update document
  update: async (id, documentData) => {
    const response = await api.put(`/documents/${id}`, documentData);
    return response.data;
  },
};
