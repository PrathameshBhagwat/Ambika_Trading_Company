/**
 * Vegetable API service — all vegetable-related HTTP calls.
 */

import api from './api';
import type { Vegetable, VegetableCreate, VegetableUpdate, ListResponse } from '../types';

export const vegetableService = {
  list: async (params?: {
    search?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<ListResponse<Vegetable>> => {
    const { data } = await api.get('/api/vegetables/', { params });
    return data;
  },

  get: async (id: number): Promise<Vegetable> => {
    const { data } = await api.get(`/api/vegetables/${id}`);
    return data;
  },

  create: async (vegetable: VegetableCreate): Promise<Vegetable> => {
    const { data } = await api.post('/api/vegetables/', vegetable);
    return data;
  },

  update: async (id: number, vegetable: VegetableUpdate): Promise<Vegetable> => {
    const { data } = await api.put(`/api/vegetables/${id}`, vegetable);
    return data;
  },

  deactivate: async (id: number): Promise<void> => {
    await api.delete(`/api/vegetables/${id}`);
  },
};
