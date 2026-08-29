import { createContext, useContext } from 'react';
import type { CloudBuildsState } from '../../infrastructure/cloud/useCloudBuilds';

export const CloudBuildsContext = createContext<CloudBuildsState | null>(null);

export function useOptionalCloudBuilds(): CloudBuildsState | null {
  return useContext(CloudBuildsContext);
}

export function useCloudBuildArchive(): CloudBuildsState {
  const value = useOptionalCloudBuilds();
  if (!value) {
    throw new Error('useCloudBuildArchive must be used inside CloudBuildsProvider');
  }
  return value;
}
