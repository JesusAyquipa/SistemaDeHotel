import { Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import PingTest from '../pages/PingTest';
import RegisterGuest from '../pages/staff/RegisterGuest';
import StaffManagement from '../pages/staff/StaffManagement';
import RoomsListing from '../pages/RoomsListing';

export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Catálogo Público de Habitaciones con Disponibilidad */}
      <Route path="/habitaciones" element={<RoomsListing />} />
      <Route path="/recepcionista/habitaciones" element={<RoomsListing />} />

      {/* Rutas Panel de Recepción */}
      <Route path="/recepcionista/huespedes/nuevo" element={<RegisterGuest />} />
      <Route path="/recepcionista/personal" element={<StaffManagement />} />

      {/* Rutas Públicas / Demo */}
      <Route path="/" element={<Home />} />
      <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
    </Routes>
  );
}
