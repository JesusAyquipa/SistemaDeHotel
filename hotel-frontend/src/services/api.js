import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Helper for Sanctum CSRF protection
export const getCsrfToken = () => {
  return axios.get(`${API_URL}/sanctum/csrf-cookie`, {
    withCredentials: true,
  });
};

export default api;
