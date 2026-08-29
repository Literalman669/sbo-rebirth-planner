import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@fontsource/cinzel/latin-500.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import { BuildDraftProvider } from './app/providers/BuildDraftProvider';
import { AuthProvider } from './app/providers/AuthProvider';
import { CloudDataProvider } from './app/providers/CloudDataProvider';
import { CloudBuildsProvider } from './app/providers/CloudBuildsProvider';
import { DatasetProvider } from './app/providers/DatasetProvider';
import { appRouter } from './app/router';
import { PublicDataProvider } from './infrastructure/spacetime/PublicDataProvider';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CloudDataProvider>
        <PublicDataProvider>
          <DatasetProvider>
            <BuildDraftProvider>
              <CloudBuildsProvider>
                <RouterProvider router={appRouter} />
              </CloudBuildsProvider>
            </BuildDraftProvider>
          </DatasetProvider>
        </PublicDataProvider>
      </CloudDataProvider>
    </AuthProvider>
  </StrictMode>,
);
