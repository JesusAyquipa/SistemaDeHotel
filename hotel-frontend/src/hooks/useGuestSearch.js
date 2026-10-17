import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../services/api';
import useDebouncedValue from './useDebouncedValue';
import logError from '../utils/logError';

/**
 * Búsqueda de huéspedes (solo personal: GET /guests/search).
 * Aplica debounce de 300 ms y cancela las peticiones obsoletas.
 */
export default function useGuestSearch(query, minLength = 2) {
  const debounced = useDebouncedValue(String(query || '').trim(), 300);
  const [state, setState] = useState({ term: '', results: [] });

  useEffect(() => {
    if (debounced.length < minLength) return undefined;
    const controller = new AbortController();
    api.get('/guests/search', { params: { query: debounced }, signal: controller.signal })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.guests || []);
        setState({ term: debounced, results: list });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        logError('guests:search', err);
        setState({ term: debounced, results: [] });
      });
    return () => controller.abort();
  }, [debounced, minLength]);

  // Solo devolver resultados que correspondan al término vigente
  return debounced.length >= minLength && state.term === debounced ? state.results : [];
}
