import { Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import PingTest from '../pages/PingTest';
import RegisterGuest from '../pages/staff/RegisterGuest';

export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Ruta Panel de Recepción - Registrar Huésped */}
      <Route path="/recepcionista/huespedes/nuevo" element={<RegisterGuest />} />

      {/* Rutas Públicas / Demo */}
      <Route path="/" element={<Home />} />
      <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
    </Routes>
  );
}
