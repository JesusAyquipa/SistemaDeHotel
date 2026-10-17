import StaffSidebar from './StaffSidebar';

/**
 * Contenedor estándar de las páginas del personal: barra lateral + área de contenido.
 */
export default function StaffLayout({ children, className = 'bg-[#fbf9f4]', contentClassName = 'bg-[#dcdad5]' }) {
  return (
    <div className={`flex flex-col md:flex-row h-screen text-[#1b1c19] font-sans overflow-hidden ${className}`}>
      <StaffSidebar />
      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
