import { useState } from 'react';
import { registerGuest } from '../services/guestService';

export default function GuestRegistrationForm({ onSuccess, onCancel }) {
  const initialFormState = {
    name: '',
    surname: '',
    document_type: 'DNI',
    document_number: '',
    birth_date: '',
    nationality: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar error del campo modificado
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // 1. Validar Nombre (solo letras y espacios)
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio.';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.name.trim())) {
      newErrors.name = 'El nombre solo debe contener letras y espacios (no números ni símbolos).';
    }

    // 2. Validar Apellidos (solo letras y espacios)
    if (!formData.surname.trim()) {
      newErrors.surname = 'Los apellidos son obligatorios.';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.surname.trim())) {
      newErrors.surname = 'Los apellidos solo deben contener letras y espacios (no números ni símbolos).';
    }

    // 3. Validar Número de Documento según el Tipo
    if (!formData.document_number.trim()) {
      newErrors.document_number = 'El número de documento es obligatorio.';
    } else if (formData.document_type === 'DNI') {
      if (!/^[0-9]{8}$/.test(formData.document_number.trim())) {
        newErrors.document_number = 'El DNI debe contener exactamente 8 números.';
      }
    } else {
      if (!/^[a-zA-Z0-9\-]+$/.test(formData.document_number.trim())) {
        newErrors.document_number = 'El número de documento solo debe contener letras, números o guiones.';
      }
    }

    // 4. Validar Fecha de Nacimiento (no futura)
    if (formData.birth_date) {
      const selectedDate = new Date(formData.birth_date);
      const today = new Date();
      if (selectedDate > today) {
        newErrors.birth_date = 'La fecha de nacimiento no puede ser una fecha futura.';
      }
    }

    // 5. Validar Nacionalidad (solo letras si se completa)
    if (formData.nationality.trim() && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.nationality.trim())) {
      newErrors.nationality = 'La nacionalidad solo debe contener letras.';
    }

    // 6. Validar Teléfono (formato telefónico si se completa)
    if (formData.phone.trim() && !/^[0-9+\s\-()]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Ingrese un número de teléfono válido (ej. +51 987654321).';
    }

    // 7. Validar Correo Electrónico
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Ingrese una dirección de correo electrónico válida.';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);
    setErrors({});

    try {
      const response = await registerGuest(formData);

      // Reiniciar el formulario tras el guardado exitoso
      setFormData(initialFormState);

      if (onSuccess) {
        onSuccess(response.message || 'Huésped registrado correctamente en la Base de Datos');
      }
    } catch (err) {
      if (err.response && err.response.status === 422) {
        // Errores de validación devueltos por el backend (Laravel)
        const serverErrors = err.response.data.errors || {};
        const formattedErrors = {};
        Object.keys(serverErrors).forEach((key) => {
          formattedErrors[key] = Array.isArray(serverErrors[key])
            ? serverErrors[key][0]
            : serverErrors[key];
        });
        setErrors(formattedErrors);
      } else {
        setGeneralError(
          err.response?.data?.message ||
            'Error de conexión con la Base de Datos o el servidor Backend. Verifique que la extensión pdo_mysql esté activa en PHP.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F7F6F3] border-paper p-6 sm:p-10 relative shadow-sm rounded-xs">
      {/* Alerta general de error de conexión o servidor */}
      {generalError && (
        <div className="mb-6 p-4 bg-[#FDF2F2] border-l-4 border-[#7A2E2E] text-[#7A2E2E] rounded text-sm flex items-center gap-3 font-sans">
          <span className="material-symbols-outlined text-xl">error</span>
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Sección 1: Datos Personales */}
        <div className="mb-10 sm:mb-12">
          <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4d4635] text-xl">person</span>
            Datos Personales
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className={`label-ledger ${errors.name ? 'text-[#7A2E2E]' : ''}`}>
                Nombre *
              </label>
              <input
                className={`input-ledger ${errors.name ? 'border-[#7A2E2E] focus:border-[#7A2E2E]' : ''}`}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej. Arthur"
              />
              {errors.name && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className={`label-ledger ${errors.surname ? 'text-[#7A2E2E]' : ''}`}>
                Apellidos *
              </label>
              <input
                className={`input-ledger ${errors.surname ? 'border-[#7A2E2E] focus:border-[#7A2E2E]' : ''}`}
                type="text"
                name="surname"
                value={formData.surname}
                onChange={handleChange}
                placeholder="Ej. Pendleton"
              />
              {errors.surname && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.surname}</p>
              )}
            </div>

            <div>
              <label className="label-ledger">Tipo de Documento</label>
              <select
                className="input-ledger appearance-none bg-transparent cursor-pointer"
                name="document_type"
                value={formData.document_type}
                onChange={handleChange}
              >
                <option value="DNI">DNI (Documento Nacional de Identidad)</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Carné de Extranjería">Carné de extranjería</option>
              </select>
            </div>

            {/* Campo DNI / Documento con validación */}
            <div>
              <label className={`label-ledger ${errors.document_number ? 'text-[#7A2E2E]' : ''}`}>
                Número de Documento ({formData.document_type}) *
              </label>
              <input
                className={`input-ledger ${
                  errors.document_number
                    ? 'border-[#7A2E2E] focus:border-[#7A2E2E] text-[#7A2E2E] font-mono'
                    : ''
                }`}
                type="text"
                name="document_number"
                value={formData.document_number}
                onChange={handleChange}
                placeholder={formData.document_type === 'DNI' ? 'Ej. 73829102 (8 dígitos)' : 'Ej. P-123456'}
              />
              {errors.document_number && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">
                  {errors.document_number}
                </p>
              )}
            </div>

            <div>
              <label className={`label-ledger ${errors.birth_date ? 'text-[#7A2E2E]' : ''}`}>
                Fecha de Nacimiento
              </label>
              <input
                className={`input-ledger ${errors.birth_date ? 'border-[#7A2E2E] focus:border-[#7A2E2E]' : ''}`}
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
              />
              {errors.birth_date && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.birth_date}</p>
              )}
            </div>

            <div>
              <label className={`label-ledger ${errors.nationality ? 'text-[#7A2E2E]' : ''}`}>
                Nacionalidad
              </label>
              <input
                className={`input-ledger ${errors.nationality ? 'border-[#7A2E2E] focus:border-[#7A2E2E]' : ''}`}
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                placeholder="Ej. Peruana / Británica"
              />
              {errors.nationality && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.nationality}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2: Información de Contacto */}
        <div className="mb-10 sm:mb-12">
          <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4d4635] text-xl">contact_mail</span>
            Información de Contacto
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className={`label-ledger ${errors.phone ? 'text-[#7A2E2E]' : ''}`}>
                Teléfono de Contacto
              </label>
              <input
                className={`input-ledger ${errors.phone ? 'border-[#7A2E2E] focus:border-[#7A2E2E]' : ''}`}
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. +51 987654321"
              />
              {errors.phone && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className={`label-ledger ${errors.email ? 'text-[#7A2E2E]' : ''}`}>
                Correo Electrónico *
              </label>
              <input
                className={`input-ledger ${
                  errors.email
                    ? 'border-[#7A2E2E] focus:border-[#7A2E2E] text-[#7A2E2E] font-mono'
                    : ''
                }`}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
              />
              {errors.email && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label-ledger">Dirección de Domicilio</label>
              <input
                className="input-ledger"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Ej. Av. Larco 123, Miraflores, Lima"
              />
            </div>
          </div>
        </div>

        {/* Sección 3: Notas Adicionales */}
        <div className="mb-10 sm:mb-12">
          <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4d4635] text-xl">notes</span>
            Notas Adicionales
          </h3>

          <div>
            <label className="label-ledger">Observaciones y Preferencias</label>
            <textarea
              className="input-ledger resize-none h-28"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Ingrese preferencias del huésped, alergias, requerimientos de habitación o solicitudes especiales..."
            ></textarea>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 mt-8 pt-6 border-t border-[#d1c5af]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-secondary w-full sm:w-auto text-center disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full sm:w-auto text-center flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                <span>Guardando huésped...</span>
              </>
            ) : (
              'Guardar huésped'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
