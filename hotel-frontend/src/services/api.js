import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Helper for Sanctum CSRF protection
export const getCsrfToken = () => {
  return axios.get('http://localhost:8000/sanctum/csrf-cookie', {
    withCredentials: true,
  });
};

export default api;
