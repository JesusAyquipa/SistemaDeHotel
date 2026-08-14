import { useState, useEffect } from 'react';
import api from '../services/api';

export default function PingTest({ setPingStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkPing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/ping');
      setData(response.data);
      if (setPingStatus) setPingStatus({ connected: true, data: response.data });
    } catch (err) {
      setError(err.message || 'Error de conexión con la API de Laravel');
      if (setPingStatus) setPingStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPing();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🔌</span> Test de Conexión: React ↔ Laravel API
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Verificando endpoint <code className="bg-slate-800 text-indigo-400 px-2 py-0.5 rounded font-mono text-xs">GET /api/ping</code>
            </p>
          </div>
          <button
            onClick={checkPing}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition shadow-indigo-600/30 shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Probando...' : 'Re-probar API'}
          </button>
        </div>

        {loading && (
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-center animate-pulse">
            <span className="text-indigo-400 font-medium">Realizando petición a http://localhost:8000/api/ping...</span>
          </div>
        )}

        {error && (
          <div className="bg-amber-950/40 border border-amber-800/50 p-5 rounded-xl text-amber-300">
            <div className="font-bold flex items-center gap-2 text-lg">
              <span>⚠️</span> Backend No Detectado en http://localhost:8000
            </div>
            <p className="text-sm text-amber-400/90 mt-2">
              Asegúrate de haber iniciado el servidor de Laravel en la carpeta <code className="bg-amber-900/50 px-2 py-0.5 rounded">hotel-backend</code> con:
            </p>
            <pre className="bg-slate-950 p-3 rounded-lg mt-3 text-xs text-indigo-300 font-mono overflow-x-auto">
              cd hotel-backend{'\n'}
              php artisan serve
            </pre>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-5 rounded-xl text-emerald-300 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-bold text-lg text-emerald-400">{data.message}</div>
                <div className="text-xs text-emerald-500 mt-0.5">Timestamp API: {data.timestamp}</div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Respuesta JSON desde Laravel:</h3>
              <pre className="text-xs font-mono text-cyan-300 overflow-x-auto bg-slate-900 p-3 rounded-lg">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
