import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { AuthProvider } from './auth/AuthProvider';
import { SessionProvider } from './state/SessionContext';
import './styles/theme.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SessionProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </SessionProvider>
    </AuthProvider>
  </StrictMode>,
);
