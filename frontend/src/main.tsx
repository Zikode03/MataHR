import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './styles.css';
import './theme.css';
import './auth/login.css';
import './auth/roles.css';
import './attendance/clock.css';
import { LiveApp } from './live/LiveApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LiveApp />
    </BrowserRouter>
  </StrictMode>,
);
