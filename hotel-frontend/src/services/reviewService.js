import api from './api';

/** Reseñas publicadas de una habitación: { summary, data, meta } (público). */
export const getRoomReviews = async (roomId, { page = 1, perPage = 5, signal } = {}) => {
  const response = await api.get(`/rooms/${roomId}/reviews`, { params: { page, per_page: perPage }, signal });
  return response.data;
};

/** Moderación (admin): { data, meta, counts } */
export const getStaffReviews = async (params = {}) => {
  const clean = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) clean[k] = v;
  });
  const response = await api.get('/staff/reviews', { params: clean });
  return response.data;
};

export const publishReview = async (id) => (await api.post(`/staff/reviews/${id}/publish`)).data;

export const hideReview = async (id) => (await api.post(`/staff/reviews/${id}/hide`)).data;

export const replyReview = async (id, reply) => (await api.put(`/staff/reviews/${id}/reply`, { reply })).data;

export default { getRoomReviews, getStaffReviews, publishReview, hideReview, replyReview };
