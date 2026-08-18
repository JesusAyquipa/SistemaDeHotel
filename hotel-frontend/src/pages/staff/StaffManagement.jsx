import { useState, useEffect } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import Toast from '../../components/Toast';
import { getStaff, createStaff, updateStaff, toggleStaffStatus } from '../../services/staffService';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'recepcionista',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await getStaff();
      setStaffList(data);
    } catch (err) {
      console.error('Error fetching staff', err);
      showNotification('Error al cargar la lista del personal');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    // Clear error
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: null });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.email.trim()) errors.email = 'El correo electrónico es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Correo electrónico inválido';
    
    if (!isEditing && !formData.password) errors.password = 'La contraseña es requerida para nuevos usuarios';
    if (formData.password && formData.password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres';
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      if (isEditing) {
        await updateStaff(editingId, formData);
        showNotification('Personal actualizado exitosamente');
      } else {
        await createStaff(formData);
        showNotification('Personal registrado exitosamente');
      }
      resetForm();
      fetchStaff();
    } catch (err) {
      console.error('Error saving staff', err);
      if (err.response && err.response.status === 422) {
        // Validación backend
        const serverErrors = err.response.data.errors || {};
        const formattedErrors = {};
        Object.keys(serverErrors).forEach(key => {
          formattedErrors[key] = Array.isArray(serverErrors[key]) ? serverErrors[key][0] : serverErrors[key];
        });
        setFormErrors(formattedErrors);
      } else {
        showNotification('Ocurrió un error al guardar los datos');
      }
    }
  };

  const handleEdit = (staff) => {
    setIsEditing(true);
    setEditingId(staff.id);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '', // Password field empty when editing
      role: staff.primary_role,
      is_active: staff.is_active
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (staff) => {
    try {
      await toggleStaffStatus(staff.id);
      showNotification(`Cuenta de ${staff.name} ${!staff.is_active ? 'activada' : 'desactivada'}`);
      fetchStaff();
    } catch (err) {
      console.error('Error toggling status', err);
      showNotification('Error al cambiar el estado del usuario');
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'recepcionista',
      is_active: true
    });
    setFormErrors({});
  };

  return (
    <div className="bg-[#EDEBE6] text-[#1b1c19] antialiased min-h-screen flex flex-col md:flex-row overflow-x-hidden font-sans">
      <StaffSidebar />

      <main className="flex-1 p-4 sm:p-8 md:p-12 relative overflow-y-auto max-w-5xl mx-auto w-full">
        <Toast
          message={toastMessage}
          isOpen={showToast}
          onClose={() => setShowToast(false)}
        />

        <div className="mt-2 sm:mt-6 pb-16">
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#4d4635]">
              manage_accounts
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#1b1c19]">
              Gestión de Personal
            </h2>
          </div>

          {/* Formulario */}
          <div className="bg-[#F7F6F3] border-paper p-6 sm:p-8 shadow-sm rounded-xs mb-8">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4d4635] text-xl">
                {isEditing ? 'edit' : 'person_add'}
              </span>
              {isEditing ? 'Editar Personal' : 'Registrar Nuevo Personal'}
            </h3>

            <form onSubmit={handleSubmit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="label-ledger">Nombre Completo *</label>
                  <input
                    className={`input-ledger ${formErrors.name ? 'border-[#7A2E2E]' : ''}`}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Ej. Juan Pérez"
                  />
                  {formErrors.name && <p className="text-[#7A2E2E] font-mono text-xs mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="label-ledger">Correo Electrónico *</label>
                  <input
                    className={`input-ledger ${formErrors.email ? 'border-[#7A2E2E]' : ''}`}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="juan@correo.com"
                  />
                  {formErrors.email && <p className="text-[#7A2E2E] font-mono text-xs mt-1">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="label-ledger">
                    Contraseña {isEditing ? '(Dejar en blanco para mantener actual)' : '*'}
                  </label>
                  <input
                    className={`input-ledger ${formErrors.password ? 'border-[#7A2E2E]' : ''}`}
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Mínimo 6 caracteres"
                  />
                  {formErrors.password && <p className="text-[#7A2E2E] font-mono text-xs mt-1">{formErrors.password}</p>}
                </div>

                <div>
                  <label className="label-ledger">Rol en el Sistema *</label>
                  <select
                    className="input-ledger cursor-pointer"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                  >
                    <option value="admin">Administrador</option>
                    <option value="recepcionista">Recepcionista</option>
                    <option value="cliente">Cliente / Huésped</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 mt-8 pt-6 border-t border-[#d1c5af]">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary w-full sm:w-auto text-center"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto text-center"
                >
                  {isEditing ? 'Guardar Cambios' : 'Registrar Personal'}
                </button>
              </div>
            </form>
          </div>

          {/* Listado de Personal */}
          <div className="bg-[#F7F6F3] border-paper p-6 sm:p-8 shadow-sm rounded-xs">
            <h3 className="font-serif text-lg font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4d4635] text-xl">groups</span>
              Listado de Personal
            </h3>

            {loading ? (
              <div className="text-center p-8">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#c9a227]">sync</span>
                <p className="font-mono text-xs mt-2 text-[#4d4635]">Cargando personal...</p>
              </div>
            ) : staffList.length === 0 ? (
              <div className="text-center p-8 text-[#4d4635]">
                <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                <p className="font-sans text-sm">No hay personal registrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#d1c5af] text-[#755b00] font-mono text-xs uppercase tracking-wider bg-[#eae8e3]">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Correo</th>
                      <th className="p-3">Rol</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((staff) => (
                      <tr key={staff.id} className="border-b border-[#e4e2dd] hover:bg-[#fbf9f4] transition-colors">
                        <td className="p-3 font-semibold text-[#1b1c19]">{staff.name}</td>
                        <td className="p-3 text-[#4d4635]">{staff.email}</td>
                        <td className="p-3 uppercase text-[10px] tracking-wider font-bold text-[#525e7d]">
                          {staff.primary_role}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${staff.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>
                            {staff.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleEdit(staff)}
                            className="text-[#4d4635] hover:text-[#1b1c19] transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(staff)}
                            className={`${staff.is_active ? 'text-[#991b1b]' : 'text-[#166534]'} hover:brightness-110 transition-colors`}
                            title={staff.is_active ? 'Desactivar' : 'Activar'}
                          >
                            <span className="material-symbols-outlined text-lg">
                              {staff.is_active ? 'block' : 'check_circle'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
