import { Routes, Route } from 'react-router-dom';
import Home from '../pages/Home';
import PingTest from '../pages/PingTest';
import Login from '../pages/Login';
import RegisterGuest from '../pages/staff/RegisterGuest';
import ProtectedRoute from '../components/ProtectedRoute';
export default function AppRoutes({ pingStatus, setPingStatus }) {
  return (
    <Routes>
      {/* Autenticación */}
      <Route path="/login" element={<Login />} />

      {/* Panel de Recepción */}
      <Route
  path="/recepcionista/huespedes/nuevo"
  element={
    <ProtectedRoute allowedRoles={['admin', 'recepcionista']}>
      <RegisterGuest />
    </ProtectedRoute>
  }
/>

      {/* Rutas Públicas / Demo */}
      <Route path="/" element={<Home />} />
      <Route
        path="/ping"
        element={<PingTest setPingStatus={setPingStatus} />}
      />
    </Routes>
  );
}
