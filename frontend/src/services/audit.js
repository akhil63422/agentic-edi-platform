import api from './api';
import { localDataStore } from '@/store/localDataStore';

export const auditService = {
  // Get all audit logs (uses localStorage when imported data exists)
  getAll: async (params = {}) => {
    const data = localDataStore.getData();
    if (data) {
      return localDataStore.filterAuditLogs(data.audit_logs, {
        skip: params.skip ?? 0,
        limit: params.limit ?? 100,
        action_type: params.action_type,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        user_id: params.user_id,
      });
    }
    const { skip = 0, limit = 100, action_type, entity_type, entity_id, user_id, start_date, end_date } = params;
    const queryParams = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (action_type) queryParams.append('action_type', action_type);
    if (entity_type) queryParams.append('entity_type', entity_type);
    if (entity_id) queryParams.append('entity_id', entity_id);
    if (user_id) queryParams.append('user_id', user_id);
    if (start_date) queryParams.append('start_date', start_date);
    if (end_date) queryParams.append('end_date', end_date);
    const response = await api.get(`/audit/?${queryParams}`);
    return response.data;
  },

  // Get audit log by ID
  getById: async (id) => {
    const data = localDataStore.getData();
    if (data) {
      const found = data.audit_logs.find(
        (a) => String(a._id) === String(id) || String(a.id) === String(id)
      );
      if (found) return found;
    }
    const response = await api.get(`/audit/${id}`);
    return response.data;
  },
};
