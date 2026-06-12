import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </StrictMode>,
);
