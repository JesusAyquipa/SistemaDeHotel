import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] flex flex-col font-sans">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative h-[85vh] w-full flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] hover:scale-105"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1920&q=80')", 
            backgroundPosition: 'center 40%' 
          }}
        >
          {/* Overlay gradiente */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#14213d]/80 via-[#14213d]/40 to-[#14213d]/90"></div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <span className="font-mono text-xs md:text-sm text-[#c9a227] uppercase tracking-[0.3em] mb-6 block drop-shadow-md">
            Un Icono de la Ciudad de los Reyes
          </span>
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
            Sheraton Lima Hotel <br/>
            <span className="text-3xl md:text-5xl italic font-light text-[#eae8e3]">& Convention Center</span>
          </h1>
          <p className="text-lg md:text-xl text-[#d1c5af] mb-10 max-w-2xl font-light drop-shadow-md">
            Descubra el punto de encuentro perfecto entre la historia fascinante del centro de Lima y el confort moderno de clase mundial.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/habitaciones"
              className="bg-[#c9a227] hover:bg-[#b08d22] text-white px-8 py-4 font-mono text-sm uppercase tracking-widest transition-all duration-300 transform hover:-translate-y-1 shadow-lg"
            >
              Reservar Ahora
            </Link>
            <Link
              to="/experience"
              className="bg-transparent border border-white hover:bg-white hover:text-[#14213d] text-white px-8 py-4 font-mono text-sm uppercase tracking-widest transition-all duration-300"
            >
              Explorar el Hotel
            </Link>
          </div>
        </div>
      </section>

      {/* Intro Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="font-serif text-4xl text-[#14213d] font-bold">Tradición y Excelencia en el Corazón de Lima</h2>
            <div className="w-16 h-1 bg-[#c9a227]"></div>
            <p className="text-[#4d4635] leading-relaxed text-lg">
              Estratégicamente ubicado en la entrada al centro histórico de Lima, nuestro icónico hotel es un faro de hospitalidad peruana. Con vistas impresionantes a la ciudad y al Paseo de los Héroes Navales, ofrecemos un refugio sofisticado tanto para viajeros de negocios como de placer.
            </p>
            <p className="text-[#4d4635] leading-relaxed text-lg">
              Desde 1973, hemos sido testigos y anfitriones de los eventos más importantes del país, combinando la rica gastronomía local con un servicio impecable que anticipa cada una de sus necesidades.
            </p>
          </div>
          <div className="relative h-[500px]">
            <img 
              src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80" 
              alt="Sheraton Lima Fachada" 
              className="absolute inset-0 w-full h-full object-cover shadow-2xl"
            />
            <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-[#f5f3ee] -z-10"></div>
            <div className="absolute -top-6 -right-6 w-48 h-48 border-2 border-[#c9a227] -z-10"></div>
          </div>
        </div>
      </section>

      {/* Featured Amenities */}
      <section className="py-24 bg-[#14213d] text-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="font-mono text-sm text-[#c9a227] uppercase tracking-[0.2em]">Servicios Exclusivos</span>
            <h2 className="font-serif text-4xl mt-4">Comodidad sin Compromisos</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="border border-[#2a3b5c] p-8 hover:bg-[#1a2b4c] transition-colors duration-300">
              <span className="material-symbols-outlined text-4xl text-[#c9a227] mb-4">restaurant</span>
              <h3 className="font-serif text-xl mb-3">Gastronomía Peruana</h3>
              <p className="text-[#a3b1c6] font-light leading-relaxed">Deleite su paladar en nuestro Restaurante Mariva, donde los sabores auténticos del Perú se fusionan con técnicas internacionales en cada plato.</p>
            </div>
            <div className="border border-[#2a3b5c] p-8 hover:bg-[#1a2b4c] transition-colors duration-300">
              <span className="material-symbols-outlined text-4xl text-[#c9a227] mb-4">meeting_room</span>
              <h3 className="font-serif text-xl mb-3">Centro de Convenciones</h3>
              <p className="text-[#a3b1c6] font-light leading-relaxed">Con más de 3,000 metros cuadrados de espacio flexible, somos el principal destino en Lima para congresos, bodas y eventos corporativos.</p>
            </div>
            <div className="border border-[#2a3b5c] p-8 hover:bg-[#1a2b4c] transition-colors duration-300">
              <span className="material-symbols-outlined text-4xl text-[#c9a227] mb-4">pool</span>
              <h3 className="font-serif text-xl mb-3">Piscina y Fitness Center</h3>
              <p className="text-[#a3b1c6] font-light leading-relaxed">Mantenga su rutina de ejercicios en nuestro gimnasio equipado y relájese en nuestra hermosa piscina al aire libre tras un día en la ciudad.</p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
