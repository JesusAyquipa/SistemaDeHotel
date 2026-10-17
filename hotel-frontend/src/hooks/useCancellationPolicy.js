import { useEffect, useState } from 'react';
import { getCancellationPolicy } from '../services/billingService';
import { DEFAULT_CANCELLATION_POLICY } from '../utils/cancellationPolicy';
import logError from '../utils/logError';

/**
 * Política de cancelación vigente (GET público, SHE-028). Mientras carga o si
 * falla, devuelve los valores por defecto.
 */
export default function useCancellationPolicy() {
  const [policy, setPolicy] = useState(DEFAULT_CANCELLATION_POLICY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getCancellationPolicy()
      .then((data) => { if (active && data) setPolicy(data); })
      .catch((err) => logError('policy:fetch', err))
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return { policy, loaded };
}
