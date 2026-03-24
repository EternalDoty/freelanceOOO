import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getStoredToken = (): string | null => {
  const directToken = localStorage.getItem('token');
  if (directToken) return directToken;

  const authStorageRaw = localStorage.getItem('auth-storage');
  if (!authStorageRaw) return null;

  try {
    const parsed = JSON.parse(authStorageRaw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  verify: (token: string) => api.post('/auth/verify', { token }),
  getMe: () => api.get('/auth/me'),
};

export const tasksApi = {
  getAll: (params?: Record<string, string>) => api.get('/tasks', { params }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  submitProposal: (taskId: string, data: any) => api.post(`/tasks/${taskId}/proposals`, data),
  acceptProposal: (taskId: string, proposalId: string) => 
    api.post(`/tasks/${taskId}/proposals/${proposalId}/accept`),
};

export const escrowApi = {
  getById: (id: string) => api.get(`/escrow/${id}`),
  fund: (id: string, walletTransactionId: string) => 
    api.post(`/escrow/${id}/fund`, { wallet_transaction_id: walletTransactionId }),
  release: (id: string) => api.post(`/escrow/${id}/release`),
  dispute: (id: string, data: { reason: string; evidence: string[] }) => 
    api.post(`/escrow/${id}/dispute`, data),
  calculateCommission: (amount: number) => 
    api.get(`/escrow/commission/calculate`, { params: { amount } }),
};

export const appealsApi = {
  create: (data: Record<string, unknown>) => api.post('/appeals', data),
  getMy: () => api.get('/appeals/my'),
  getAll: (params?: Record<string, string>) => api.get('/appeals', { params }),
  review: (id: string, data: any) => api.post(`/appeals/${id}/review`, data),
};

export const supportApi = {
  createTicket: (data: Record<string, unknown>) => api.post('/support/tickets', data),
  sendMessage: (ticketId: string, message: string) => 
    api.post(`/support/tickets/${ticketId}/messages`, { message }),
  getMyTickets: () => api.get('/support/tickets/my'),
  getAllTickets: (params?: Record<string, string>) => 
    api.get('/support/tickets', { params }),
  assignTicket: (ticketId: string) => api.post(`/support/tickets/${ticketId}/assign`),
  closeTicket: (ticketId: string) => api.post(`/support/tickets/${ticketId}/close`),
};

export default api;
