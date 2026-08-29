import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { BuildDraftProvider } from './app/providers/BuildDraftProvider';
import { DatasetProvider } from './app/providers/DatasetProvider';
import { appRouter } from './app/router';
import { PublicDataProvider } from './infrastructure/spacetime/PublicDataProvider';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicDataProvider>
      <DatasetProvider>
        <BuildDraftProvider>
          <RouterProvider router={appRouter} />
        </BuildDraftProvider>
      </DatasetProvider>
    </PublicDataProvider>
  </StrictMode>,
);
