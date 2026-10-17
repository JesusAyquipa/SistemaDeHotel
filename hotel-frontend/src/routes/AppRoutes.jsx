import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import ProtectedRoute from '../components/ProtectedRoute';
import PageLoader from '../components/PageLoader';

// SHE-040: las páginas se cargan bajo demanda (code splitting). Home queda en el bundle
// inicial porque es la primera pantalla pública.
const PingTest = lazy(() => import('../pages/PingTest'));
const RegisterGuest = lazy(() => import('../pages/staff/RegisterGuest'));
const StaffManagement = lazy(() => import('../pages/staff/StaffManagement'));
const RoomManagement = lazy(() => import('../pages/staff/RoomManagement'));
const HousekeepingDashboard = lazy(() => import('../pages/staff/HousekeepingDashboard'));
const RoomAccount = lazy(() => import('../pages/staff/RoomAccount'));
const RoomsListing = lazy(() => import('../pages/RoomsListing'));
const RoomDetail = lazy(() => import('../pages/RoomDetail'));
const GuestManagement = lazy(() => import('../pages/staff/GuestManagement'));
const GuestDetail = lazy(() => import('../pages/staff/GuestDetail'));
const GuestLogin = lazy(() => import('../pages/GuestLogin'));
const BookingManagement = lazy(() => import('../pages/staff/BookingManagement'));
const ReceptionistBooking = lazy(() => import('../pages/staff/ReceptionistBooking'));
const ReportsDashboard = lazy(() => import('../pages/staff/ReportsDashboard'));
const SettingsDashboard = lazy(() => import('../pages/staff/SettingsDashboard'));
const MyBookings = lazy(() => import('../pages/MyBookings'));
const MyBookingDetail = lazy(() => import('../pages/MyBookingDetail'));
const ResetPassword = lazy(() => import('../pages/ResetPassword'));
const Experience = lazy(() => import('../pages/Experience'));
const About = lazy(() => import('../pages/About'));
const ProductCatalog = lazy(() => import('../pages/admin/ProductCatalog'));
const RoomTypes = lazy(() => import('../pages/admin/RoomTypes'));
const ActivityLog = lazy(() => import('../pages/admin/ActivityLog'));
const ReviewModeration = lazy(() => import('../pages/admin/ReviewModeration'));
const FrontDeskToday = lazy(() => import('../pages/staff/FrontDeskToday'));
const FrontDeskRack = lazy(() => import('../pages/staff/FrontDeskRack'));
const InvoiceManagement = lazy(() => import('../pages/admin/InvoiceManagement'));
const RefundManagement = lazy(() => import('../pages/admin/RefundManagement'));
const NotFound = lazy(() => import('../pages/NotFound'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Login Route Único */}
        <Route path="/login" element={<GuestLogin />} />
      
        {/* Password Reset */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public Pages */}
        <Route path="/habitaciones" element={<RoomsListing />} />
        <Route path="/habitaciones/:id" element={<RoomDetail />} />
        <Route path="/experience" element={<Experience />} />
        <Route path="/about" element={<About />} />

        {/* Rutas de Perfil del Huésped (Cliente) */}
        <Route path="/cliente/mis-reservas/:code" element={
          <ProtectedRoute allowedRoles={['cliente', 'admin', 'recepcionista']}>
            <MyBookingDetail />
          </ProtectedRoute>
        } />
        <Route path="/cliente/mis-reservas" element={
          <ProtectedRoute allowedRoles={['cliente', 'admin', 'recepcionista']}>
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
        <Route path="/admin/productos" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ProductCatalog />
          </ProtectedRoute>
        } />
        <Route path="/admin/tipos-habitacion" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <RoomTypes />
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
        <Route path="/admin/huespedes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <GuestManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/huespedes/:id" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <GuestDetail />
          </ProtectedRoute>
        } />
        <Route path="/admin/personal" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <StaffManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/resenas" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ReviewModeration />
          </ProtectedRoute>
        } />
        <Route path="/admin/auditoria" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <ActivityLog />
          </ProtectedRoute>
        } />
        {/* Facturación (G1): comprobantes y reembolsos */}
        <Route path="/admin/comprobantes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <InvoiceManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/reembolsos" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <RefundManagement />
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
        <Route path="/recepcionista/huespedes" element={
          <ProtectedRoute allowedRoles={['recepcionista']}>
            <GuestManagement />
          </ProtectedRoute>
        } />
        <Route path="/recepcionista/huespedes/:id" element={
          <ProtectedRoute allowedRoles={['recepcionista']}>
            <GuestDetail />
          </ProtectedRoute>
        } />

        {/* ---------------- RECEPCIÓN: Hoy, Rack y Housekeeping (SHE-030/031/032) ---------------- */}
        <Route path="/recepcionista/hoy" element={
          <ProtectedRoute allowedRoles={['recepcionista']}>
            <FrontDeskToday />
          </ProtectedRoute>
        } />
        <Route path="/recepcionista/rack" element={
          <ProtectedRoute allowedRoles={['recepcionista']}>
            <FrontDeskRack />
          </ProtectedRoute>
        } />
        <Route path="/admin/hoy" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <FrontDeskToday />
          </ProtectedRoute>
        } />
        <Route path="/admin/rack" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <FrontDeskRack />
          </ProtectedRoute>
        } />
        <Route path="/admin/housekeeping" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <HousekeepingDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/habitaciones/:id/cuenta" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <RoomAccount />
          </ProtectedRoute>
        } />

        {/* Compatibilidad hacia atrás (Redirecciones) para links antiguos */}
        <Route path="/mis-reservas" element={<Navigate to="/cliente/mis-reservas" replace />} />

        {/* Rutas Públicas / Demo */}
        <Route path="/" element={<Home />} />
        <Route path="/ping" element={<PingTest />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
