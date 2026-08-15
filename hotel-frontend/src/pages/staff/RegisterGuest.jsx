import { useState } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import GuestRegistrationForm from '../../components/GuestRegistrationForm';
import Toast from '../../components/Toast';

export default function RegisterGuest() {
  const [toastMessage, setToastMessage] = useState('Huésped registrado correctamente');
  const [showToast, setShowToast] = useState(false);

  const handleFormSuccess = (message) => {
    if (message) setToastMessage(message);
    setShowToast(true);
  };

  const handleCancel = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#EDEBE6] text-[#1b1c19] antialiased min-h-screen flex flex-col md:flex-row overflow-x-hidden font-sans">
      {/* Sidebar Fijo (Desktop) / Drawer Hamburger (Mobile) */}
      <StaffSidebar />

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-8 md:p-12 relative overflow-y-auto max-w-5xl mx-auto w-full">
        {/* Toast Notificación flotante */}
        <Toast
          message={toastMessage}
          isOpen={showToast}
          onClose={() => setShowToast(false)}
        />

        <div className="mt-2 sm:mt-6 pb-16">
          {/* Header de la vista */}
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <span className="material-symbols-outlined text-3xl sm:text-4xl text-[#4d4635]">
              local_post_office
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#1b1c19]">
              Registrar nuevo huésped
            </h2>
          </div>

          {/* Componente Formulario Ledger */}
          <GuestRegistrationForm
            onSuccess={handleFormSuccess}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}
