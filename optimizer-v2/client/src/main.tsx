import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectedApp } from './app/App';
import { PublicDataProvider } from './infrastructure/spacetime/PublicDataProvider';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicDataProvider>
      <ConnectedApp />
    </PublicDataProvider>
  </StrictMode>,
);
