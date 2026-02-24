import api from './api';

export const partnerAIService = {
  // Process chat message
  processChat: async (message, conversationHistory = [], context = {}) => {
    const formData = new FormData();
    formData.append('message', message);
    if (conversationHistory.length > 0) {
      formData.append('conversation_history', JSON.stringify(conversationHistory));
    }
    if (Object.keys(context).length > 0) {
      formData.append('context', JSON.stringify(context));
    }
    
    const response = await api.post('/partners/ai/chat', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Process voice input
  processVoice: async (audioFile) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    
    const response = await api.post('/partners/ai/voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Process document upload
  processDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/partners/ai/document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Save partner from AI extracted data
  savePartner: async (partnerData) => {
    const response = await api.post('/partners/ai/save-partner', partnerData);
    return response.data;
  },
};
