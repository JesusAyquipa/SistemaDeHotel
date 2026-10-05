import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function Experience() {
  return (
    <div className="bg-surface-dim font-body-md text-on-surface flex flex-col min-h-screen">
      <PublicHeader />
      
      <main className="w-full bg-surface-dim flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-on-secondary-fixed">
          <div className="absolute inset-0 w-full h-full">
            <img 
              alt="Experiencias Curadas" 
              className="w-full h-full object-cover opacity-60 mix-blend-luminosity" 
              src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=2070" 
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-on-secondary-fixed via-transparent to-transparent opacity-80"></div>
          <div className="relative z-10 bg-surface/95 backdrop-blur-sm border border-outline-variant p-guest-density shadow-xl text-center max-w-2xl mx-guest-density">
            <h1 className="font-display-lg text-display-lg text-on-surface mb-staff-density uppercase tracking-tighter">
              Experiencias Curadas
            </h1>
            <p className="font-headline-sm text-headline-sm text-primary italic">A Journey of the Senses</p>
          </div>
        </section>

        {/* Availability Selector (Booking Context) */}
        <section className="w-full bg-surface-container border-b border-outline-variant shadow-sm relative z-20">
          <div className="max-w-[1200px] mx-auto px-guest-density py-guest-density">
            <div className="flex flex-col md:flex-row items-stretch gap-guest-density justify-between bg-surface border border-outline-variant p-staff-density">
              <div className="flex-1 flex flex-col sm:flex-row w-full gap-staff-density">
                <div className="flex-1 relative group flex flex-col justify-end">
                  <label className="absolute top-2 left-3 font-utility-sm text-utility-sm text-on-surface-variant uppercase tracking-widest transition-all group-focus-within:text-primary z-10">Check-In</label>
                  <input className="w-full bg-transparent border-b-2 border-outline-variant focus:border-primary outline-none px-3 pt-8 pb-2 font-body-md text-on-surface text-body-md transition-colors" type="date" />
                </div>
                <div className="hidden sm:block w-px bg-outline-variant my-2"></div>
                <div className="flex-1 relative group flex flex-col justify-end">
                  <label className="absolute top-2 left-3 font-utility-sm text-utility-sm text-on-surface-variant uppercase tracking-widest transition-all group-focus-within:text-primary z-10">Check-Out</label>
                  <input className="w-full bg-transparent border-b-2 border-outline-variant focus:border-primary outline-none px-3 pt-8 pb-2 font-body-md text-on-surface text-body-md transition-colors" type="date" />
                </div>
                <div className="hidden sm:block w-px bg-outline-variant my-2"></div>
                <div className="flex-1 relative group flex flex-col justify-end">
                  <label className="absolute top-2 left-3 font-utility-sm text-utility-sm text-on-surface-variant uppercase tracking-widest transition-all group-focus-within:text-primary z-10">Guests</label>
                  <select className="w-full bg-transparent border-b-2 border-outline-variant focus:border-primary outline-none px-3 pt-8 pb-2 font-body-md text-on-surface text-body-md transition-colors appearance-none">
                    <option>1 Adult</option>
                    <option>2 Adults</option>
                    <option>3 Adults</option>
                    <option>4 Adults</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 bottom-2 text-on-surface-variant pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="w-full md:w-auto flex flex-col justify-end flex-shrink-0">
                <button className="w-full md:w-auto bg-primary text-[#ffffff] px-margin-desktop py-4 font-utility-md text-utility-md uppercase tracking-widest border border-primary hover:bg-[#ffffff] hover:text-primary transition-all shadow-sm cursor-pointer">
                  Update Stay
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content: Services */}
        <section className="max-w-[1200px] mx-auto w-full px-guest-density py-margin-desktop flex-grow space-y-margin-desktop">
          <div className="text-center space-y-staff-density flex flex-col items-center">
            <span className="font-utility-md text-utility-md text-outline uppercase tracking-widest block">Beyond Your Stay</span>
            <h2 className="font-display-md text-[32px] text-on-surface uppercase tracking-tight">Nuestros Servicios Exclusivos</h2>
            <div className="w-16 h-px bg-primary mt-guest-density"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-guest-density items-stretch">
            {/* Card 1: Spa & Wellness */}
            <article className="bg-surface border border-outline-variant flex flex-col group hover:shadow-md transition-shadow duration-300 h-full">
              <div className="relative w-full h-56 overflow-hidden bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-multiply group-hover:scale-105 transition-transform duration-700" 
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDkByQeMGhbhPtLDckX9N-7TKTKk67IPof3Kvic2oVOS5JvaRnjnBvjzUXQ9QX4c9stGUyRPw1FYZLCEWhYWttDwDrriFLt_kBXxvre2rUnv7BEF85j-l7J6NYQ-GidaXe-SsYR0QsouQMPF0RbJwdb3M9WpmqjEQIUzCjYHUkuPWq59N-E34o4e43IYsuvQJrzkrsx7-eneHLDeD-EEu-EkKSDiiHspQWp3KgIzHLFuXclyyXtpLwlAQ')" }}
                ></div>
                <span className="material-symbols-outlined text-[48px] text-primary relative z-10 drop-shadow-md">spa</span>
              </div>
              <div className="p-guest-density flex flex-col flex-1">
                <div className="flex justify-between items-start mb-staff-density gap-2">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface uppercase">Spa &amp; Wellness</h3>
                  <span className="bg-primary/10 text-primary px-2 py-1 font-utility-sm text-utility-sm border border-primary/20 whitespace-nowrap">+$120/Session</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant flex-grow mb-guest-density">
                  Masaje Signature o Tratamientos de Lujo. Un retiro restaurador diseñado para equilibrar cuerpo y mente en nuestro santuario subterráneo.
                </p>
                <button className="w-full bg-transparent border border-on-secondary-fixed text-on-secondary-fixed px-staff-density py-3 font-utility-md text-utility-md uppercase tracking-widest hover:bg-on-secondary-fixed hover:text-[#ffffff] transition-colors mt-auto cursor-pointer">
                  Añadir a mi experiencia
                </button>
              </div>
            </article>

            {/* Card 2: Fine Dining */}
            <article className="bg-surface border border-outline-variant flex flex-col group hover:shadow-md transition-shadow duration-300 h-full">
              <div className="relative w-full h-56 overflow-hidden bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-multiply group-hover:scale-105 transition-transform duration-700" 
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDy4-S8W2OQw_PQaOEiHtbyh6wfFEV_jAsrT0OMdEeAPKeq9ZlQiDO8SRM9th47ft53DGgJiY9shw6lLhv4rQ5nlmysuztli3Oq-eEgzn_Kgqgd8SJUflyvsdewCimeZZXpDGTi2nAqLNfyKIKZET-0hEi5t--InB_DFjViFjCsyGe7kX6xOLP9kFUXQeVQAWUSgG80LlfnCqupPpLmeubJ3RJi51hsduBY2DdmDl5gj3XnzQuEcZ4dPw')" }}
                ></div>
                <span className="material-symbols-outlined text-[48px] text-primary relative z-10 drop-shadow-md">restaurant</span>
              </div>
              <div className="p-guest-density flex flex-col flex-1">
                <div className="flex justify-between items-start mb-staff-density gap-2">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface uppercase">Fine Dining</h3>
                  <span className="bg-primary/10 text-primary px-2 py-1 font-utility-sm text-utility-sm border border-primary/20 whitespace-nowrap">+$85/Person</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant flex-grow mb-guest-density">
                  Cena de Degustación en el Restaurante Principal o Menú Exclusivo. Sabores de herencia preparados por nuestro equipo culinario experto.
                </p>
                <button className="w-full bg-transparent border border-on-secondary-fixed text-on-secondary-fixed px-staff-density py-3 font-utility-md text-utility-md uppercase tracking-widest hover:bg-on-secondary-fixed hover:text-[#ffffff] transition-colors mt-auto cursor-pointer">
                  Añadir a mi experiencia
                </button>
              </div>
            </article>

            {/* Card 3: Hospitality Services */}
            <article className="bg-surface border border-outline-variant flex flex-col group hover:shadow-md transition-shadow duration-300 h-full">
              <div className="relative w-full h-56 overflow-hidden bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-multiply group-hover:scale-105 transition-transform duration-700" 
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCyA1BhCTr0vB-1c3txXnsMSrxi7EGH5LN26wMcROcZN8mI7qVHVs6mFolPC52TJ0Oka8bF_aIp6vtrXrDfAZk06EfwPIfzL4AnZh34Fx5Yry-9gdmr6teADlEIhUXN6t6oy8bkbeNp6eyGgqiytmJZlPAyLcD3RhOD-kvL0RsI003nHUFhp-KcdNvn4IrkHdJ1rbbM5baXkelN9clSOJl41pKR5UAAEy2QeNgWgYJHcniDuhWxNkEYOQ')" }}
                ></div>
                <span className="material-symbols-outlined text-[48px] text-primary relative z-10 drop-shadow-md">room_service</span>
              </div>
              <div className="p-guest-density flex flex-col flex-1">
                <div className="flex justify-between items-start mb-staff-density gap-2">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface uppercase">Hospitality</h3>
                  <span className="bg-primary/10 text-primary px-2 py-1 font-utility-sm text-utility-sm border border-primary/20 whitespace-nowrap">+$45/Selection</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant flex-grow mb-guest-density">
                  Selección de Vinos Premium &amp; Snacks o Catálogo de Productos Exclusivos. Amenidades dispuestas en su habitación antes de su llegada.
                </p>
                <button className="w-full bg-transparent border border-on-secondary-fixed text-on-secondary-fixed px-staff-density py-3 font-utility-md text-utility-md uppercase tracking-widest hover:bg-on-secondary-fixed hover:text-[#ffffff] transition-colors mt-auto cursor-pointer">
                  Añadir a mi experiencia
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
