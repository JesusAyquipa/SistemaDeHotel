import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function About() {
  return (
    <div className="bg-surface-dim font-body-md text-on-surface flex flex-col min-h-screen">
      <PublicHeader />
      
      <main className="w-full bg-surface-dim flex-grow flex flex-col">
        {/* Hero Section */}
        <section className="relative w-full h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden bg-on-secondary-fixed">
          <div className="absolute inset-0 w-full h-full">
            <img 
              alt="Nuestra Historia" 
              className="w-full h-full object-cover opacity-60 mix-blend-luminosity" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrur5AHsDwCm_-ytNWQjdAFBJeozNkajjzyYmU1g_GuTEJo-kTVK9PDi29elMbex2ECJvQcbjxxcuZZygUKK_0NmNp4o6ETa3XprzuMv9ewMv4QmqFTyxotSkW8O9aleR0eGhl_zGJ0KoHiSOf3ovOLWcc63E7fKQt4mv4YwM_rles5EZApAnUgLNmWpnmcDeO3e_3pXRLglN1C1Kxd8xAuVmluLndXq1HPyXaNEYOoTpitb_dsGwT2w" 
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-on-secondary-fixed via-transparent to-transparent opacity-80"></div>
          <div className="relative z-10 bg-surface/95 backdrop-blur-sm border border-outline-variant p-margin-desktop shadow-xl text-center max-w-[600px] mx-guest-density">
            <h1 className="font-display-lg text-display-lg text-on-surface mb-staff-density">NUESTRA HISTORIA</h1>
            <p className="font-headline-sm text-headline-sm text-primary italic">Un Legado Centenario</p>
          </div>
        </section>

        {/* Narrative Section */}
        <section className="max-w-[1200px] mx-auto px-guest-density py-margin-desktop md:py-[120px] w-full">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-center">
            <div className="md:col-span-5 md:col-start-2 relative">
              <div className="bg-surface p-staff-density border border-outline-variant shadow-sm rotate-[-2deg]">
                <img 
                  className="w-full h-auto object-cover grayscale sepia" 
                  alt="A close-up photograph of a vintage handwritten guest ledger from 1894" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYFhXr-dhp0pkrOKWJ5oI23OxtWETW9pCTgstGQcGP4-G-c4UdC-e_QYjOHvXszwpNcvjhffOaF06xumiqdCfXdfRfDepsf0LGkG3FV6ECrEnC4xwaPmwMk2wmjVQeE6MHg5eXI2oxQqDK-HRS5dYrMIXWw4o2PWRIuWM59K8MYcw8jV45zOvqQ0Gk699L1Pqm_ctUeitadJLH1TEDKKPLSuS1D40oguYTcUy9UQMCsQcaEcvik9krAw" 
                />
              </div>
            </div>
            <div className="md:col-span-5 flex flex-col gap-guest-density mt-margin-desktop md:mt-0">
              <h2 className="font-display-md text-display-md text-on-surface">UN LEGADO DE MÁS DE UN SIGLO</h2>
              <div className="w-12 h-1 bg-primary"></div>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                  Fundado en 1973, Sheraton Lima Hotel nació con una visión singular: proporcionar un santuario de permanencia física y elegancia atemporal. En una época de constante cambio, hemos mantenido nuestro compromiso con la meticulosidad de antaño.
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant">
                  Cada anotación en nuestro registro, cada llave de bronce entregada, cuenta la historia de viajeros que buscaron no solo un lugar donde descansar, sino una experiencia de hospitalidad genuina y discreta. Nuestras paredes resguardan los secretos y las alegrías de más de un siglo de huéspedes ilustres.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="w-full bg-surface-container-high py-margin-desktop md:py-[100px] border-y border-outline-variant">
          <div className="max-w-[1200px] mx-auto px-guest-density">
            <div className="text-center mb-margin-desktop">
              <h2 className="font-utility-md text-utility-md uppercase tracking-widest text-primary mb-staff-density">NUESTROS VALORES</h2>
              <div className="font-display-md text-display-md text-on-surface">Los Pilares del Ledger</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {/* Value 1 */}
              <div className="bg-surface p-guest-density border border-outline-variant shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <span className="material-symbols-outlined text-[48px] text-primary mb-guest-density group-hover:scale-110 transition-transform">room_service</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-staff-density">Servicio Intachable</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Anticipamos sus necesidades antes de que sean expresadas, con una atención discreta y siempre presente, como la tinta en una página en blanco.
                </p>
              </div>
              {/* Value 2 */}
              <div className="bg-surface p-guest-density border border-outline-variant shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <span className="material-symbols-outlined text-[48px] text-primary mb-guest-density group-hover:scale-110 transition-transform">diamond</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-staff-density">Elegancia Atemporal</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Nuestros espacios están diseñados para trascender las modas, ofreciendo un refugio de belleza clásica y materiales honestos que envejecen con gracia.
                </p>
              </div>
              {/* Value 3 */}
              <div className="bg-surface p-guest-density border border-outline-variant shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <span className="material-symbols-outlined text-[48px] text-primary mb-guest-density group-hover:scale-110 transition-transform">stylus</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-staff-density">Meticulosidad</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Como un libro de contabilidad perfectamente cuadrado, cada detalle de su estadía es revisado y perfeccionado, asegurando una experiencia sin fisuras.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="max-w-[1200px] mx-auto px-guest-density py-margin-desktop md:py-[120px] w-full">
          <h2 className="font-display-md text-display-md text-on-surface mb-margin-desktop text-center">EL EQUIPO DETRÁS DEL CONFORT</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter items-start">
            {/* Staff 1 */}
            <div className="flex flex-col">
              <div className="bg-surface p-staff-density border border-outline-variant shadow-sm mb-guest-density">
                <img alt="Executive Chef" className="w-full h-[400px] object-cover grayscale hover:grayscale-0 transition-all duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDz6ucbzKHNxc3a6d4CQEjBs7fm5Ypp_ngLY6uS3NRs-Y0zS7Sbtcyr4imp-mVzJyy7yC5yQceBb7s-RL6OeOnKu1MStBKwQJS3qGDLgCn_ssUYtJ-dmLcSpWsbdaTvrmz300wIrAE4Mzzo-wPMnSs4AlBgsjTaGT-iXWQzfO6xjCWutiTQCoAPaD9F32OCyAeE7FOziUn4u976KMZwqgrPvaRPC47l6KzP8iu0H3gms8_iv6pr9l8ZzA" />
              </div>
              <div className="flex justify-between items-end border-b-2 border-outline pb-staff-density">
                <h4 className="font-headline-sm text-headline-sm text-on-surface">Jean-Luc Dupont</h4>
                <span className="font-utility-sm text-utility-sm uppercase text-primary">Executive Chef</span>
              </div>
            </div>
            {/* Staff 2 */}
            <div className="flex flex-col">
              <div className="bg-surface p-staff-density border border-outline-variant shadow-sm mb-guest-density">
                <img alt="Reception Lead" className="w-full h-[400px] object-cover grayscale hover:grayscale-0 transition-all duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLptYdaO9uZVpgrAPh88WwaxBAn7La0FXCGiUsaWAa4mnQh_OAJucVgLj554WmgA91K9JPt19FEGA13n6z2xdsQWYh8-ln-r3h8s8_cs1qNM3-xsO5xxy3VDJHdP9CTiKROJll2xC3toyWarlIztsCipwQzr9ao4DkWUtjAH8hElk5jADpj7TI8TYfn5-ShjRy6v4TOT0CbZDS7YFNL7DR7LkWolQE2T52zsaFqWQjHufJSi9jB6ohyg" />
              </div>
              <div className="flex justify-between items-end border-b-2 border-outline pb-staff-density">
                <h4 className="font-headline-sm text-headline-sm text-on-surface">Maria Rossi</h4>
                <span className="font-utility-sm text-utility-sm uppercase text-primary">Reception Lead</span>
              </div>
            </div>
            {/* Staff 3 */}
            <div className="flex flex-col">
              <div className="bg-surface p-staff-density border border-outline-variant shadow-sm mb-guest-density">
                <img alt="Head Concierge" className="w-full h-[400px] object-cover grayscale hover:grayscale-0 transition-all duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4bec7wkSh-aAQJODUB3hHJcAcw-rp81ocSAa0HirVybdS0ZzwLrKVALY9OU6mXrTRz9PRdtUbX3b9eQW3mzeodMBzujIYZ3ICiD-uL5MyUWwngDnptK9JWRanyJ7iUp3NzjVUehJh5ht4xd0LAJcan8keL5rZJnAS8CZkJ9XUqQp6-hzQsRjmY9b4cJ5Mn_ndMf22jqDOKhUGszqwunH4X-l1wP6Ad0vIGuc0MheXhwAjttaWMB69lA" />
              </div>
              <div className="flex justify-between items-end border-b-2 border-outline pb-staff-density">
                <h4 className="font-headline-sm text-headline-sm text-on-surface">Arthur Pendelton</h4>
                <span className="font-utility-sm text-utility-sm uppercase text-primary">Head Concierge</span>
              </div>
            </div>
          </div>
        </section>

        {/* Contact & Data Section */}
        <section className="w-full bg-inverse-surface py-margin-desktop md:py-[80px]">
          <div className="max-w-[1200px] mx-auto px-guest-density flex flex-col md:flex-row justify-between items-center gap-margin-desktop">
            <div className="text-inverse-on-surface">
              <h2 className="font-display-md text-display-md mb-staff-density">DATOS DEL HOTEL Y CONTACTO</h2>
              <p className="font-body-md text-body-md text-surface-variant max-w-md">
                  Para consultas de reserva o solicitudes especiales, nuestro personal está a su disposición.
              </p>
            </div>
            <div className="bg-surface p-guest-density border border-outline shadow-md flex flex-col gap-staff-density min-w-[300px]">
              <div className="flex justify-between items-center border-b border-outline-variant pb-unit">
                <span className="font-utility-sm text-utility-sm text-on-surface-variant uppercase">Dirección</span>
                <span className="font-utility-md text-utility-md text-on-surface text-right">Avenida España 123<br />Lima, Perú</span>
              </div>
              <div className="flex justify-between items-center border-b border-outline-variant pb-unit pt-unit">
                <span className="font-utility-sm text-utility-sm text-on-surface-variant uppercase">Teléfono</span>
                <span className="font-utility-md text-utility-md text-on-surface">+51 1 615 1234</span>
              </div>
              <div className="flex justify-between items-center pt-unit">
                <span className="font-utility-sm text-utility-sm text-on-surface-variant uppercase">Telegrama/Email</span>
                <span className="font-utility-md text-utility-md text-on-surface">reservations@thegrandledger.com</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
