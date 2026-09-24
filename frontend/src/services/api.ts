/**
 * Ambika Trading — API Client
 *
 * Axios instance configured to talk to the local FastAPI backend.
 * All service modules import this base client.
 */

import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8741';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with an error status
      const detail = error.response.data?.detail || 'An error occurred';
      console.error(`API Error [${error.response.status}]: ${detail}`);
    } else if (error.request) {
      // Network error — backend may not be running
      console.error('Network error: Backend server is not responding');
    }
    return Promise.reject(error);
  }
);

export default api;
