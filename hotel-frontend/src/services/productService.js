import api from './api';

export const getProducts = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await api.get(`/staff/products?${params.toString()}`);
  return response.data.products;
};

export const createProduct = async (productData) => {
  const response = await api.post('/staff/products', productData);
  return response.data;
};

export const updateProduct = async (id, productData) => {
  const response = await api.put(`/staff/products/${id}`, productData);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/staff/products/${id}`);
  return response.data;
};
