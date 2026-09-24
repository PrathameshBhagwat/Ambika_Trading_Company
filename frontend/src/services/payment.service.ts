/**
 * Payment API service — record payments, list payment history.
 */

import api from './api';
import type { PaymentCreate, PaymentResponse, ListResponse } from '../types';

export const paymentService = {
  create: async (payment: PaymentCreate): Promise<PaymentResponse> => {
    const { data } = await api.post('/api/payments/', payment);
    return data;
  },

  listForTransaction: async (transactionId: number): Promise<ListResponse<PaymentResponse>> => {
    const { data } = await api.get(`/api/payments/transaction/${transactionId}`);
    return data;
  },

  listForFarmer: async (
    farmerId: number,
    params?: { date_from?: string; date_to?: string }
  ): Promise<ListResponse<PaymentResponse>> => {
    const { data } = await api.get(`/api/payments/farmer/${farmerId}`, { params });
    return data;
  },
};
