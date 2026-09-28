import React, { useState, useEffect } from 'react';
import StaffSidebar from '../../components/StaffSidebar';
import NewSeasonModal from '../../components/staff/NewSeasonModal';
import NewCouponModal from '../../components/staff/NewCouponModal';
import api from '../../services/api';
import Toast from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

export default function SettingsDashboard() {
  const [seasons, setSeasons] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin');
  
  const [toastMessage, setToastMessage] = useState(null);
  
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      setSeasons(res.data.seasons);
      setCoupons(res.data.coupons);
    } catch (error) {
      setToastMessage('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeason = async (seasonData) => {
    try {
      await api.post('/settings/seasons', seasonData);
      setToastMessage('Temporada agregada exitosamente');
      fetchSettings();
      setIsSeasonModalOpen(false);
    } catch (err) {
      setToastMessage('Error guardando temporada');
    }
  };

  const handleSaveCoupon = async (couponData) => {
    try {
      await api.post('/settings/coupons', couponData);
      setToastMessage('Cupón agregado exitosamente');
      fetchSettings();
      setIsCouponModalOpen(false);
    } catch (err) {
      setToastMessage('Error guardando cupón');
    }
  };

  const deleteSeason = async (id) => {
    if (!window.confirm('¿Eliminar esta temporada?')) return;
    try {
      await api.delete(`/settings/seasons/${id}`);
      setToastMessage('Temporada eliminada');
      fetchSettings();
    } catch(e) {
      setToastMessage('Error eliminando temporada');
    }
  };

  const deleteCoupon = async (id) => {
    if (!window.confirm('¿Eliminar este cupón?')) return;
    try {
      await api.delete(`/settings/coupons/${id}`);
      setToastMessage('Cupón eliminado');
      fetchSettings();
    } catch(e) {
      setToastMessage('Error eliminando cupón');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex h-screen bg-[#e5e4de] text-[#1b1c19] font-sans">
      <StaffSidebar />
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} type={toastMessage.includes('Error') ? 'error' : 'success'} />
      )}
      
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-5xl mx-auto flex flex-col gap-10 animate-fadeIn">
          
          <div className="flex justify-between items-end">
            <div>
              <h1 className="font-serif text-3xl font-bold text-[#1b1c19] mb-1 tracking-tight">Configuración General</h1>
              <p className="font-mono text-sm text-[#4d4635] tracking-wide">Gestión de Temporadas y Cupones Promocionales</p>
            </div>
            {isAdmin && (
              <button className="bg-[#987d35] hover:bg-[#7a642a] text-white font-mono text-xs font-bold uppercase tracking-widest px-6 py-2.5 transition-colors shadow-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">save</span>
                Guardar Cambios
              </button>
            )}
          </div>

          {/* Temporadas */}
          <div className="bg-[#fcfcfc] border-l-4 border-l-[#987d35] shadow-sm rounded-r-md p-6 relative">
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#987d35]">calendar_month</span>
                  <h2 className="font-serif text-xl font-bold text-[#2d2d2a]">Gestión de Temporadas</h2>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setIsSeasonModalOpen(true)}
                    className="bg-transparent border border-[#987d35] text-[#987d35] hover:bg-[#f5f3ee] transition-colors font-mono text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Nueva Temporada
                  </button>
                )}
             </div>

             <div className="w-full">
               <div className="grid grid-cols-5 bg-[#2d2d2a] text-white font-mono text-[10px] uppercase font-bold tracking-widest p-3 rounded-sm mb-2">
                 <div className="col-span-1">NOMBRE</div>
                 <div className="col-span-1">RANGO DE FECHAS</div>
                 <div className="col-span-1 text-center">AJUSTE DE TARIFA</div>
                 <div className="col-span-1 text-center">ESTADO</div>
                 {isAdmin && <div className="col-span-1 text-right">ACCIONES</div>}
               </div>

               {seasons.map(s => (
                 <div key={s.id} className="grid grid-cols-5 items-center font-sans text-sm text-[#4d4635] p-3 border-b border-[#eae8e3] hover:bg-[#fbf9f4] transition-colors">
                   <div className="col-span-1 font-bold text-[#1b1c19]">{s.name}</div>
                   <div className="col-span-1">{formatDate(s.start_date)} - {formatDate(s.end_date)}</div>
                   <div className="col-span-1 text-center font-mono text-[#ba1a1a] font-bold">
                     {s.rate_adjustment > 0 ? `+${s.rate_adjustment}%` : `${s.rate_adjustment}%`}
                   </div>
                   <div className="col-span-1 flex justify-center">
                     <span className={`px-2 py-1 rounded-full font-mono text-[9px] font-bold tracking-widest uppercase flex items-center gap-1 ${s.is_active ? 'bg-[#e5efff] text-[#0047b3]' : 'bg-[#e4e2dd] text-[#78716c]'}`}>
                       <div className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-[#0047b3]' : 'bg-[#78716c]'}`}></div>
                       {s.is_active ? 'Activo' : 'Inactivo'}
                     </span>
                   </div>
                   {isAdmin && (
                     <div className="col-span-1 flex justify-end gap-2">
                       <button className="text-[#a39f96] hover:text-[#987d35] transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                       <button onClick={() => deleteSeason(s.id)} className="text-[#a39f96] hover:text-[#ba1a1a] transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                     </div>
                   )}
                 </div>
               ))}
               {seasons.length === 0 && <div className="text-center p-4 text-sm text-gray-400">Sin temporadas registradas.</div>}
             </div>
          </div>

          {/* Cupones */}
          <div className="bg-[#fcfcfc] border-l-4 border-l-[#525e7d] shadow-sm rounded-r-md p-6 relative">
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#525e7d]">local_activity</span>
                  <h2 className="font-serif text-xl font-bold text-[#2d2d2a]">Cupones Promocionales</h2>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setIsCouponModalOpen(true)}
                    className="bg-transparent border border-[#525e7d] text-[#525e7d] hover:bg-[#f0f4f8] transition-colors font-mono text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Nuevo Cupón
                  </button>
                )}
             </div>

             <div className="w-full">
               <div className="grid grid-cols-6 bg-[#2d2d2a] text-white font-mono text-[10px] uppercase font-bold tracking-widest p-3 rounded-sm mb-2">
                 <div className="col-span-1">CÓDIGO</div>
                 <div className="col-span-1 text-center">DESCUENTO</div>
                 <div className="col-span-1 text-center">CADUCIDAD</div>
                 <div className="col-span-1 text-center">LÍMITE DE USOS</div>
                 <div className="col-span-1 text-center">ESTADO</div>
                 {isAdmin && <div className="col-span-1 text-right">ACCIONES</div>}
               </div>

               {coupons.map(c => {
                 const isExpired = new Date(c.expires_at) < new Date();
                 const isUsedUp = c.max_uses && c.current_uses >= c.max_uses;
                 let statusText = 'Activo';
                 let statusColor = 'bg-[#e5efff] text-[#0047b3]';
                 let dotColor = 'bg-[#0047b3]';
                 
                 if (isExpired) {
                    statusText = 'Expirado';
                    statusColor = 'bg-[#ffdad6] text-[#ba1a1a]';
                    dotColor = 'bg-[#ba1a1a]';
                 } else if (isUsedUp) {
                    statusText = 'Agotado';
                    statusColor = 'bg-[#e4e2dd] text-[#78716c]';
                    dotColor = 'bg-[#78716c]';
                 }
                 
                 return (
                 <div key={c.id} className="grid grid-cols-6 items-center font-sans text-sm text-[#4d4635] p-3 border-b border-[#eae8e3] hover:bg-[#fbf9f4] transition-colors">
                   <div className="col-span-1 font-bold">
                     <span className="bg-[#f5f3ee] text-[#7a642a] border border-[#d1c5af] px-2 py-0.5 rounded font-mono text-xs">{c.code}</span>
                   </div>
                   <div className="col-span-1 text-center font-bold text-[#987d35]">
                     {c.discount_type === 'percentage' ? `${parseFloat(c.discount_value)}%` : `$${parseFloat(c.discount_value).toFixed(2)} USD`}
                   </div>
                   <div className="col-span-1 text-center">{formatDate(c.expires_at)}</div>
                   <div className="col-span-1 flex items-center justify-center gap-2">
                     <div className="w-16 h-1.5 bg-[#e4e2dd] rounded-full overflow-hidden relative">
                       {c.max_uses ? (
                          <div className="absolute top-0 left-0 h-full bg-[#987d35]" style={{width: `${Math.min(100, (c.current_uses / c.max_uses) * 100)}%`}}></div>
                       ) : (
                          <div className="absolute top-0 left-0 h-full bg-[#a39f96] w-full"></div>
                       )}
                     </div>
                     <span className="font-mono text-[9px] text-[#78716c] font-bold">{c.max_uses ? `${c.current_uses}/${c.max_uses}` : '∞'}</span>
                   </div>
                   <div className="col-span-1 flex justify-center">
                     <span className={`px-2 py-1 rounded-full font-mono text-[9px] font-bold tracking-widest uppercase flex items-center gap-1 ${statusColor}`}>
                       <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                       {statusText}
                     </span>
                   </div>
                   {isAdmin && (
                     <div className="col-span-1 flex justify-end gap-2">
                       <button className="text-[#a39f96] hover:text-[#525e7d] transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                       <button onClick={() => deleteCoupon(c.id)} className="text-[#a39f96] hover:text-[#ba1a1a] transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                     </div>
                   )}
                 </div>
               )})}
               {coupons.length === 0 && <div className="text-center p-4 text-sm text-gray-400">Sin cupones registrados.</div>}
             </div>
          </div>
          
        </div>
      </div>
      
      <NewSeasonModal isOpen={isSeasonModalOpen} onClose={() => setIsSeasonModalOpen(false)} onSave={handleSaveSeason} />
      <NewCouponModal isOpen={isCouponModalOpen} onClose={() => setIsCouponModalOpen(false)} onSave={handleSaveCoupon} />
    </div>
  );
}
