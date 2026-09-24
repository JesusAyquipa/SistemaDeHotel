import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  const [pingStatus, setPingStatus] = useState(null);

  return (
    <Router>
      <AppRoutes pingStatus={pingStatus} setPingStatus={setPingStatus} />
    </Router>
  );
}
