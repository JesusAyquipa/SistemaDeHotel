import api from './api';

export const getStaff = async () => {
  const response = await api.get('/staff');
  return response.data.data;
};

export const createStaff = async (staffData) => {
  const response = await api.post('/staff', staffData);
  return response.data;
};

export const updateStaff = async (id, staffData) => {
  const response = await api.put(`/staff/${id}`, staffData);
  return response.data;
};

export const toggleStaffStatus = async (id) => {
  const response = await api.patch(`/staff/${id}/toggle-status`);
  return response.data;
};
