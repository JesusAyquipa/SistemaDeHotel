import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PingTest from './pages/PingTest';

export default function App() {
  const [pingStatus, setPingStatus] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar pingStatus={pingStatus} />
        <main className="flex-1 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ping" element={<PingTest setPingStatus={setPingStatus} />} />
          </Routes>
        </main>
        <footer className="bg-slate-900 border-t border-slate-800 text-center py-4 text-xs text-slate-500">
          Monorepo Sistema de Reservas de Hotel • Equipo 3 Personas (Scrum)
        </footer>
      </div>
    </Router>
  );
}
