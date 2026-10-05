import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function About() {
  return (
    <div className="bg-surface-dim font-body-md text-on-surface flex flex-col min-h-screen">
      <PublicHeader />
      
      <main className="w-full bg-surface-dim flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-on-secondary-fixed">
          <div className="absolute inset-0 w-full h-full">
            <img 
              alt="Sobre Nosotros" 
              className="w-full h-full object-cover opacity-60 mix-blend-luminosity" 
              src="https://images.unsplash.com/photo-1542314831-c6a4d14d8c53?auto=format&fit=crop&q=80&w=2070" 
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-on-secondary-fixed via-transparent to-transparent opacity-80"></div>
          <div className="relative z-10 bg-surface/95 backdrop-blur-sm border border-outline-variant p-guest-density shadow-xl text-center max-w-2xl mx-guest-density">
            <h1 className="font-display-lg text-display-lg text-on-surface mb-staff-density uppercase tracking-tighter">
              Nuestra Historia
            </h1>
            <p className="font-headline-sm text-headline-sm text-primary italic">A Legacy of Elegance Since 1892</p>
          </div>
        </section>

        {/* Main Content: Story */}
        <section className="max-w-[800px] mx-auto w-full px-guest-density py-margin-desktop flex-grow space-y-margin-desktop">
          <div className="text-center space-y-staff-density flex flex-col items-center">
            <span className="font-utility-md text-utility-md text-outline uppercase tracking-widest block">The Grand Ledger</span>
            <h2 className="font-display-md text-[32px] text-on-surface uppercase tracking-tight">Tradición y Modernidad</h2>
            <div className="w-16 h-px bg-primary mt-guest-density"></div>
          </div>
          
          <div className="bg-surface border border-outline-variant p-10 text-center space-y-6">
            <p className="font-body-md text-on-surface-variant leading-relaxed">
              Fundado a finales del siglo XIX, The Grand Ledger se ha mantenido como un bastión de elegancia clásica y hospitalidad incomparable. Originalmente concebido como un refugio de lujo para viajeros internacionales, nuestro edificio histórico ha sido testigo de innumerables momentos, conservando siempre su esencia arquitectónica.
            </p>
            <p className="font-body-md text-on-surface-variant leading-relaxed">
              Hoy, fusionamos esta rica herencia con las comodidades del mundo moderno, ofreciendo a nuestros huéspedes no solo un lugar para descansar, sino un santuario de permanencia física en un mundo efímero.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
