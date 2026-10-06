import { Routes, Route, Navigate } from 'react-router-dom';
import PingTest from '../pages/PingTest';
import Home from '../pages/Home';
import RegisterGuest from '../pages/staff/RegisterGuest';
import StaffManagement from '../pages/staff/StaffManagement';
import RoomManagement from '../pages/staff/RoomManagement';
import HousekeepingDashboard from '../pages/staff/HousekeepingDashboard';
import RoomAccount from '../pages/staff/RoomAccount';
import RoomsListing from '../pages/RoomsListing';
import GuestLogin from '../pages/GuestLogin';
import BookingManagement from '../pages/staff/BookingManagement';
import ReceptionistBooking from '../pages/staff/ReceptionistBooking';
import ReportsDashboard from '../pages/staff/ReportsDashboard';
import SettingsDashboard from '../pages/staff/SettingsDashboard';
import ProtectedRoute from '../components/ProtectedRoute';
import MyBookings from '../pages/MyBookings';
import ResetPassword from '../pages/ResetPassword';
import Experience from '../pages/Experience';
import About from '../pages/About';

export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Login Route Único */}
      <Route path="/login" element={<GuestLogin />} />
      
      {/* Password Reset */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public Pages */}
      <Route path="/habitaciones" element={<RoomsListing />} />
      <Route path="/experience" element={<Experience />} />
      <Route path="/about" element={<About />} />

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
      <Route path="/configuracion" element={
        <ProtectedRoute allowedRoles={['admin', 'recepcionista']}>
          <SettingsDashboard />
        </ProtectedRoute>
      } />

      {/* ---------------- RUTAS RECEPCIONISTA ---------------- */}
      <Route path="/recepcionista/habitaciones" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <HousekeepingDashboard />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/habitaciones/:id/cuenta" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <RoomAccount />
        </ProtectedRoute>
      } />
      <Route path="/recepcionista/reservas" element={
        <ProtectedRoute allowedRoles={['recepcionista']}>
          <ReceptionistBooking />
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
      <Route path="/" element={<Home />} />
      <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
    </Routes>
  );
}
