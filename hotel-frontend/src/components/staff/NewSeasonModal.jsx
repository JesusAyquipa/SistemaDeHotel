import React, { useEffect, useState } from 'react';
import { getRoomTypes } from '../../services/roomTypeService';
import logError from '../../utils/logError';
import { ALL_WEEKDAYS, WEEKDAYS, describeWeekdays, toggleWeekday, weekdaysPayload } from '../../utils/weekdays';

export default function NewSeasonModal({ isOpen, onClose, onSave }) {
  // SHE-018: días de la semana en que aplica el ajuste (todos por defecto)
  const [weekdays, setWeekdays] = useState(ALL_WEEKDAYS);
  const [weekdaysError, setWeekdaysError] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adjustment, setAdjustment] = useState('');
  // SHE-034: temporada opcionalmente limitada a un tipo de habitación ('' = todos)
  const [roomTypeId, setRoomTypeId] = useState('');
  const [roomTypes, setRoomTypes] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    getRoomTypes()
      .then((data) => setRoomTypes(data.room_types || []))
      .catch((err) => logError('room-types:list', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !startDate || !endDate || !adjustment) return;
    if (weekdays.length === 0) {
      setWeekdaysError('Seleccione al menos un día de la semana.');
      return;
    }

    // Parse adjustment string (e.g., "+20%" -> 20.00, "-10%" -> -10.00)
    let rateAdj = parseFloat(adjustment.replace(/[+%]/g, ''));
    if (isNaN(rateAdj)) rateAdj = 0;

    onSave({
      name,
      start_date: startDate,
      end_date: endDate,
      rate_adjustment: rateAdj,
      room_type_id: roomTypeId ? Number(roomTypeId) : null,
      days_of_week: weekdaysPayload(weekdays),
    });

    // reset
    setName('');
    setStartDate('');
    setEndDate('');
    setAdjustment('');
    setRoomTypeId('');
    setWeekdays(ALL_WEEKDAYS);
    setWeekdaysError('');
  };

  const handleToggleDay = (value) => {
    setWeekdays((prev) => toggleWeekday(prev, value));
    setWeekdaysError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label="Registrar nueva temporada" className="bg-[#fcfcfc] w-full max-w-[450px] max-h-[95vh] overflow-y-auto shadow-2xl relative animate-fadeIn border border-[#987d35]">
        {/* Header */}
        <div className="bg-[#1b1c19] text-white p-4 flex justify-between items-center border-b-2 border-[#987d35]">
          <h2 className="font-serif font-bold text-lg">Registrar Nueva Temporada</h2>
          <button type="button" className="text-[#a39f96] hover:text-white transition-colors" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 bg-[#fbf9f4] flex flex-col gap-5">
           <div>
              <label htmlFor="season-1" className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                 NOMBRE DE LA TEMPORADA *
              </label>
              <input id="season-1"
                type="text"
                required
                placeholder="Ej. Temporada de Fiestas"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#987d35] focus:outline-none"
              />
           </div>

           <div className="flex gap-4">
              <div className="flex-1">
                 <label htmlFor="season-2" className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    FECHA DE INICIO *
                 </label>
                 <input id="season-2"
                   type="date"
                   required
                   value={startDate}
                   onChange={e => setStartDate(e.target.value)}
                   className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#987d35] focus:outline-none"
                 />
              </div>
              <div className="flex-1">
                 <label htmlFor="season-3" className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                    FECHA DE FIN *
                 </label>
                 <input id="season-3"
                   type="date"
                   required
                   value={endDate}
                   onChange={e => setEndDate(e.target.value)}
                   className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#987d35] focus:outline-none"
                 />
              </div>
           </div>

           <div>
              <label htmlFor="season-4" className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                 AJUSTE DE TARIFA (%) *
              </label>
              <input id="season-4"
                type="text"
                required
                placeholder="Ej. +20% o -10%"
                value={adjustment}
                onChange={e => setAdjustment(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#987d35] focus:outline-none"
              />
           </div>

           <div>
              <label htmlFor="season-5" className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                 TIPO DE HABITACIÓN (OPCIONAL)
              </label>
              <select id="season-5"
                value={roomTypeId}
                onChange={e => setRoomTypeId(e.target.value)}
                className="w-full bg-white border border-[#d1c5af] p-2.5 text-sm font-sans text-[#2d2d2a] focus:border-[#987d35] focus:outline-none cursor-pointer"
              >
                <option value="">Todos los tipos</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
           </div>

           <fieldset aria-describedby="season-days-hint">
              <legend className="block font-mono text-[9px] uppercase tracking-widest font-bold text-[#78716c] mb-1">
                 DÍAS DE LA SEMANA *
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const checked = weekdays.includes(d.value);
                  return (
                    <label
                      key={d.value}
                      className={`relative inline-flex items-center justify-center min-w-[44px] h-10 px-2 border font-mono text-xs font-bold cursor-pointer select-none transition-colors focus-within:ring-2 focus-within:ring-[#14213d] focus-within:ring-offset-1 ${checked ? 'bg-[#987d35] border-[#987d35] text-white' : 'bg-white border-[#d1c5af] text-[#4d4635] hover:border-[#987d35]'}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => handleToggleDay(d.value)}
                        aria-label={d.long}
                      />
                      <span aria-hidden="true">{d.short}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {[
                  ['Todos', ALL_WEEKDAYS],
                  ['Lun–Vie', [1, 2, 3, 4, 5]],
                  ['Fines de semana', [6, 0]],
                ].map(([label, days]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setWeekdays(days); setWeekdaysError(''); }}
                    className="font-mono text-[10px] uppercase tracking-wider font-bold text-[#755b00] hover:text-[#14213d] underline-offset-2 hover:underline cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p id="season-days-hint" className="font-mono text-[10px] text-[#4d4635] mt-1" aria-live="polite">
                {weekdaysError ? <span className="text-[#ba1a1a] font-bold">{weekdaysError}</span> : `Aplica: ${describeWeekdays(weekdays).toLowerCase()}.`}
              </p>
           </fieldset>

           <div className="flex justify-center gap-4 mt-4">
              <button
                type="button"
                className="bg-white border border-[#78716c] text-[#78716c] font-mono text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 hover:bg-[#eae8e3] transition-colors"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-[#987d35] text-white font-mono text-[10px] uppercase tracking-widest font-bold py-2.5 px-6 hover:bg-[#7a642a] transition-colors shadow-sm"
              >
                Guardar Temporada
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
