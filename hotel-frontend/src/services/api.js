import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Helper para obtener la cookie CSRF de Laravel Sanctum
export const getCsrfToken = () => {
  return axios.get('http://localhost:8000/sanctum/csrf-cookie', {
    withCredentials: true,
    withXSRFToken: true,
  });
};

export default api;
