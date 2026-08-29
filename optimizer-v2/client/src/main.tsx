import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectedApp } from './app/App';
import { DatasetProvider } from './app/providers/DatasetProvider';
import { PublicDataProvider } from './infrastructure/spacetime/PublicDataProvider';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicDataProvider>
      <DatasetProvider>
        <ConnectedApp />
      </DatasetProvider>
    </PublicDataProvider>
  </StrictMode>,
);
