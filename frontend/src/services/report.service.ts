/**
 * Report API service — daily summary, farmer outstanding, payment summary.
 */

import api from './api';
import type { DailySummary, FarmerOutstandingItem } from '../types';

export const reportService = {
  dailySummary: async (dateFrom: string, dateTo?: string): Promise<DailySummary> => {
    const params: Record<string, string> = { date_from: dateFrom };
    if (dateTo) params.date_to = dateTo;
    const { data } = await api.get('/api/reports/daily-summary', { params });
    return data;
  },

  farmerOutstanding: async (): Promise<{
    items: FarmerOutstandingItem[];
    grand_total_outstanding: number;
  }> => {
    const { data } = await api.get('/api/reports/farmer-outstanding');
    return data;
  },

  paymentSummary: async (dateFrom: string, dateTo?: string) => {
    const params: Record<string, string> = { date_from: dateFrom };
    if (dateTo) params.date_to = dateTo;
    const { data } = await api.get('/api/reports/payment-summary', { params });
    return data;
  },
};
