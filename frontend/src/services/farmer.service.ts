/**
 * Farmer API service — all farmer-related HTTP calls.
 */

import api from './api';
import type { Farmer, FarmerCreate, FarmerUpdate, ListResponse } from '../types';

export const farmerService = {
  list: async (params?: {
    search?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<ListResponse<Farmer>> => {
    const { data } = await api.get('/api/farmers/', { params });
    return data;
  },

  get: async (id: number): Promise<Farmer> => {
    const { data } = await api.get(`/api/farmers/${id}`);
    return data;
  },

  create: async (farmer: FarmerCreate): Promise<Farmer> => {
    const { data } = await api.post('/api/farmers/', farmer);
    return data;
  },

  update: async (id: number, farmer: FarmerUpdate): Promise<Farmer> => {
    const { data } = await api.put(`/api/farmers/${id}`, farmer);
    return data;
  },

  deactivate: async (id: number): Promise<void> => {
    await api.delete(`/api/farmers/${id}`);
  },
};
