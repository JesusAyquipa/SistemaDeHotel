import { Routes, Route, Navigate } from 'react-router-dom';
import PingTest from '../pages/PingTest';
import RegisterGuest from '../pages/staff/RegisterGuest';
import StaffManagement from '../pages/staff/StaffManagement';
import RoomManagement from '../pages/staff/RoomManagement';
import RoomsListing from '../pages/RoomsListing';
import GuestLogin from '../pages/GuestLogin';
import BookingManagement from '../pages/staff/BookingManagement';
import ReportsDashboard from '../pages/staff/ReportsDashboard';
import ProtectedRoute from '../components/ProtectedRoute';
import MyBookings from '../pages/MyBookings';

export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Login Route Único */}
      <Route path="/login" element={<GuestLogin />} />

      {/* Catálogo Público de Habitaciones con Disponibilidad para Huéspedes */}
      <Route path="/habitaciones" element={<RoomsListing />} />

      {/* Rutas de Perfil del Huésped (Cliente) */}
      <Route path="/cliente/mis-reservas" element={
        <ProtectedRoute allowedRoles={['cliente', 'admin', 'recepcionista', 'staff']}>
          <MyBookings />
        </ProtectedRoute>
      } />

      {/* ---------------- RUTAS ADMIN ---------------- */}
      <Route path="/admin/habitaciones" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <RoomManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/reservas" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <BookingManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/reportes" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <ReportsDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/huespedes/nuevo" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <RegisterGuest />
        </ProtectedRoute>
      } />
      <Route path="/admin/personal" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StaffManagement />
        </ProtectedRoute>
      } />

      {/* ---------------- RUTAS RECEPCIONISTA ---------------- */}
      <Route path="/recepcionista/habitaciones" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <RoomManagement />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/reservas" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <BookingManagement />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/huespedes/nuevo" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <RegisterGuest />
        </ProtectedRoute>
      } />

      {/* Compatibilidad hacia atrás (Redirecciones) para links antiguos */}
      <Route path="/mis-reservas" element={<Navigate to="/cliente/mis-reservas" replace />} />

      {/* Rutas Públicas / Demo */}
      <Route path="/" element={<Navigate to="/habitaciones" replace />} />
      <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
    </Routes>
  );
}
