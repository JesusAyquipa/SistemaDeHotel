import { useState } from 'react';

export default function GuestRegistrationForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    name: 'Arthur',
    surname: 'Pendleton',
    document_type: 'Pasaporte',
    document_number: 'P-1234A',
    birth_date: '1975-08-14',
    nationality: 'Británica',
    phone: '+44 20 7946 0958',
    email: 'a.pendleton@example.com',
    address: '14 Kensington Palace Gardens, Londres',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Limpiar error específico si el usuario edita el campo
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validación básica de ejemplo (ej. Número de documento)
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es obligatorio.';
    if (!formData.surname.trim()) newErrors.surname = 'Los apellidos son obligatorios.';
    if (!formData.document_number.trim()) {
      newErrors.document_number = 'El número de documento es obligatorio.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // TODO: conectar con POST /api/guests en los siguientes Sprints del backend
    console.log('Enviando datos de registro de huésped:', formData);

    if (onSuccess) {
      onSuccess('Huésped registrado correctamente');
    }
  };

  return (
    <div className="bg-[#F7F6F3] border-paper p-6 sm:p-10 relative shadow-sm rounded-xs">
      <form onSubmit={handleSubmit} noValidate>
        {/* Sección 1: Datos Personales */}
        <div className="mb-10 sm:mb-12">
          <h3 className="font-serif text-lg sm:text-xl font-semibold text-[#1b1c19] mb-6 border-b border-[#d1c5af] pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4d4635] text-xl">person</span>
            Datos Personales
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="label-ledger">Nombre</label>
              <input
                className="input-ledger"
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
              <label className="label-ledger">Apellidos</label>
              <input
                className="input-ledger"
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
                <option value="Pasaporte">Pasaporte</option>
                <option value="DNI">DNI (Documento Nacional de Identidad)</option>
                <option value="Carné de Extranjería">Carné de extranjería</option>
              </select>
            </div>

            {/* Campo con validación visual */}
            <div>
              <label className={`label-ledger ${errors.document_number ? 'text-[#7A2E2E]' : ''}`}>
                Número de Documento
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
                placeholder="Ej. P-1234A"
              />
              {errors.document_number && (
                <p className="text-[#7A2E2E] font-mono text-xs mt-1">
                  {errors.document_number}
                </p>
              )}
            </div>

            <div>
              <label className="label-ledger">Fecha de Nacimiento</label>
              <input
                className="input-ledger"
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="label-ledger">Nacionalidad</label>
              <input
                className="input-ledger"
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleChange}
                placeholder="Ej. Británica / Peruana"
              />
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
              <label className="label-ledger">Teléfono de Contacto</label>
              <input
                className="input-ledger"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ej. +44 20 7946 0958"
              />
            </div>

            <div>
              <label className="label-ledger">Correo Electrónico</label>
              <input
                className="input-ledger"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
              />
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
            className="btn-secondary w-full sm:w-auto text-center"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary w-full sm:w-auto text-center"
          >
            Guardar huésped
          </button>
        </div>
      </form>
    </div>
  );
}
