import api from './api';

/**
 * Obtener datos del dashboard de reportes (ocupación, ingresos, tabla, gráfica).
 * @param {string} dateRange Rango de fechas (30_days, this_month, last_month, ytd)
 * @returns {Promise<Object>} Data del reporte
 */
export const getDashboardReports = async (dateRange = '30_days') => {
  const response = await api.get('/staff/reports/dashboard', {
    params: { dateRange },
  });
  return response.data;
};

/**
 * Enviar cierre de caja (gaveta y vouchers)
 * @param {Object} data - Datos del cierre de caja (cash_amount, voucher_amount, expected_amount, difference)
 * @returns {Promise<Object>} Respuesta con confirmación
 */
export const closeRegister = async (data) => {
  const response = await api.post('/staff/reports/close-register', data);
  return response.data;
};

export default {
  getDashboardReports,
  closeRegister,
};
