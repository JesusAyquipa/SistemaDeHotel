import { Routes, Route, Navigate } from 'react-router-dom';
import PingTest from '../pages/PingTest';
import RegisterGuest from '../pages/staff/RegisterGuest';
import StaffManagement from '../pages/staff/StaffManagement';
import RoomManagement from '../pages/staff/RoomManagement';
import RoomsListing from '../pages/RoomsListing';
import GuestLogin from '../pages/GuestLogin';
import ProtectedRoute from '../components/ProtectedRoute';

export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Login Route Único */}
      <Route path="/login" element={<GuestLogin />} />

      {/* Catálogo Público de Habitaciones con Disponibilidad para Huéspedes */}
      <Route path="/habitaciones" element={<RoomsListing />} />

      {/* Rutas Panel de Recepción y Control de Inventario protegidas */}
      <Route path="/recepcionista/habitaciones" element={
        <ProtectedRoute allowedRoles={['recepcionista', 'admin']}>
          <RoomManagement />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/huespedes/nuevo" element={
        <ProtectedRoute allowedRoles={['recepcionista', 'admin']}>
          <RegisterGuest />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/personal" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StaffManagement />
        </ProtectedRoute>
      } />

      {/* Rutas Públicas / Demo */}
      <Route path="/" element={<Navigate to="/habitaciones" replace />} />
      <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
    </Routes>
  );
}
