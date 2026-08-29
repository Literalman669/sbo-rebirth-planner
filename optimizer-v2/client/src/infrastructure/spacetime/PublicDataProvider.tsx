import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { SpacetimeDBProvider, useTable } from 'spacetimedb/react';
import { tables } from '../../module_bindings';
import { createPublicConnectionBuilder } from './connection';
import {
  parseFormulaSetVersion,
  selectCurrentRelease,
  type DatasetRelease,
} from './releaseSelection';

const fallbackRelease: DatasetRelease = {
  version: 'bootstrap-0',
  formulaSetVersion: 'sbor-stats-v1',
  sourceSummary: 'Bundled fallback',
  publishedAtMicros: 0n,
  lastReviewedAt: '2026-08-29',
};

type PublicReleaseState = ReturnType<typeof selectCurrentRelease> & {
  isReady: boolean;
};

const PublicReleaseContext = createContext<PublicReleaseState | null>(null);

function PublicReleaseSubscription({ children }: PropsWithChildren) {
  const [rows, isReady] = useTable(tables.datasetRelease);
  const value = useMemo<PublicReleaseState>(
    () => ({
      ...selectCurrentRelease(
        rows.map((row) => ({
          version: row.version,
          formulaSetVersion: parseFormulaSetVersion(row.formulaSetVersion),
          sourceSummary: row.sourceSummary,
          publishedAtMicros: row.publishedAt.microsSinceUnixEpoch,
          lastReviewedAt: row.lastReviewedAt,
          isCurrent: row.isCurrent,
        })),
        fallbackRelease,
      ),
      isReady,
    }),
    [isReady, rows],
  );

  return (
    <PublicReleaseContext.Provider value={value}>
      {children}
    </PublicReleaseContext.Provider>
  );
}

export function PublicDataProvider({ children }: PropsWithChildren) {
  const builder = useMemo(() => createPublicConnectionBuilder(), []);

  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <PublicReleaseSubscription>{children}</PublicReleaseSubscription>
    </SpacetimeDBProvider>
  );
}

export function usePublicRelease(): PublicReleaseState {
  const value = useContext(PublicReleaseContext);

  if (!value) {
    throw new Error('usePublicRelease must be used inside PublicDataProvider');
  }

  return value;
}
