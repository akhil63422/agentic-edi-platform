import api from './api';
import { localDataStore } from '@/store/localDataStore';

export const documentsService = {
  // Get all documents (uses localStorage when imported data exists, unless forceApi=true)
  getAll: async (params = {}) => {
    const { forceApi, ...rest } = params;
    if (!forceApi) {
      const data = localDataStore.getData();
      if (data && data.documents?.length > 0) {
        return localDataStore.filterDocuments(data.documents, {
          skip: rest.skip ?? 0,
          limit: rest.limit ?? 100,
          direction: rest.direction,
          status: rest.status,
          partner_id: rest.partner_id,
          document_type: rest.document_type,
        });
      }
    }
    const { skip = 0, limit = 100, direction, status, partner_id, document_type } = rest;
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

  // Get document by ID (forceApi: skip localStorage, always fetch from backend)
  getById: async (id, forceApi = false) => {
    if (!forceApi) {
      const data = localDataStore.getData();
      if (data) {
        const found = data.documents.find(
          (d) => String(d._id) === String(id) || String(d.id) === String(id)
        );
        if (found) return found;
      }
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

  // Get document with AI review suggestions
  getReview: async (id) => {
    const response = await api.get(`/documents/${id}/review`);
    return response.data;
  },

  // Apply a field correction
  applyCorrection: async (id, correction) => {
    const response = await api.post(`/documents/${id}/review/apply`, correction);
    return response.data;
  },

  // Re-run the 10-step pipeline
  reprocess: async (id) => {
    const response = await api.post(`/documents/${id}/reprocess`);
    return response.data;
  },

  // Create outbound transmission from inbound (replaces legacy Send to ERP)
  createOutboundFromInbound: async (id) => {
    const response = await api.post(`/documents/${id}/create-outbound`);
    return response.data;
  },

  // Generate canonical JSON from parsed segments
  generateCanonical: async (id) => {
    const response = await api.post(`/documents/${id}/generate-canonical`);
    return response.data;
  },
};
