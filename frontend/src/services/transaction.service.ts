/**
 * Transaction API service — create, list, view, cancel transactions.
 */

import api from './api';
import type {
  TransactionCreate,
  TransactionResponse,
  TransactionListItem,
  ListResponse,
} from '../types';

export const transactionService = {
  list: async (params?: {
    date_from?: string;
    date_to?: string;
    farmer_id?: number;
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<ListResponse<TransactionListItem>> => {
    const { data } = await api.get('/api/transactions/', { params });
    return data;
  },

  get: async (id: number): Promise<TransactionResponse> => {
    const { data } = await api.get(`/api/transactions/${id}`);
    return data;
  },

  create: async (txn: TransactionCreate): Promise<TransactionResponse> => {
    const { data } = await api.post('/api/transactions/', txn);
    return data;
  },

  cancel: async (id: number, cancel_reason: string): Promise<TransactionResponse> => {
    const { data } = await api.post(`/api/transactions/${id}/cancel`, { cancel_reason });
    return data;
  },

  update: async (id: number, txn: any): Promise<TransactionResponse> => {
    const { data } = await api.put(`/api/transactions/${id}`, txn);
    return data;
  },

  recordPrint: async (id: number): Promise<TransactionResponse> => {
    const { data } = await api.post(`/api/transactions/${id}/print`);
    return data;
  },
};
