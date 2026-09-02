import { useEffect, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { fallbackRelease } from '../../data/fallbackRelease';
import {
  DatasetProvider,
  resolveDatasetSnapshot,
  useDataset,
} from './DatasetProvider';

function DatasetConsumer() {
  const { snapshot, source } = useDataset();
  return <p>{snapshot.version} · {source}</p>;
}

function HistoricalConsumer({ version }: { version: string }) {
  const { getSnapshot } = useDataset();
  const [resolved, setResolved] = useState('loading');
  useEffect(() => {
    void getSnapshot(version).then((snapshot) =>
      setResolved(snapshot?.version ?? 'missing'),
    );
  }, [getSnapshot, version]);
  return <p>Historical: {resolved}</p>;
}

function ReleaseIndexConsumer() {
  const { listReleases } = useDataset();
  const [resolved, setResolved] = useState('loading');
  useEffect(() => {
    void listReleases().then((releases) =>
      setResolved(
        releases
          .map((release) => `${release.version}:${release.availability}`)
          .join(','),
      ),
    );
  }, [listReleases]);
  return <p>Releases: {resolved}</p>;
}

describe('DatasetProvider', () => {
  it('turns an unavailable cache adapter into an explicit missing snapshot', async () => {
    await expect(
      resolveDatasetSnapshot(
        async () => Promise.reject(new Error('IndexedDB unavailable')),
        '2026.08.29.1',
      ),
    ).resolves.toBeNull();
  });

  it('exposes the validated bundled dataset', () => {
    render(
      <DatasetProvider>
        <DatasetConsumer />
      </DatasetProvider>,
    );

    expect(
      screen.getByText(`${fallbackRelease.version} · bundled`),
    ).toBeVisible();
  });

  it('blocks optimizer children when game data is invalid', () => {
    render(
      <DatasetProvider snapshot={{ version: 'broken' }}>
        <DatasetConsumer />
      </DatasetProvider>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Verified game data could not be loaded',
      }),
    ).toBeVisible();
    expect(screen.queryByText('broken · bundled')).not.toBeInTheDocument();
  });

  it('resolves an exact historical dataset instead of substituting the current one', async () => {
    const current = { ...bootstrapRelease, version: '2026.08.29.2' };
    const historical = { ...bootstrapRelease, version: '2026.08.29.1' };
    render(
      <DatasetProvider snapshot={current} historicalSnapshots={[historical]}>
        <HistoricalConsumer version="2026.08.29.1" />
      </DatasetProvider>,
    );

    expect(
      await screen.findByText('Historical: 2026.08.29.1'),
    ).toBeVisible();
  });

  it('lists validated endpoint metadata in publication order', async () => {
    const current = {
      ...bootstrapRelease,
      version: '2026.08.29.2',
      publishedAt: '2026-08-29T12:00:00.000Z',
    };
    const historical = {
      ...bootstrapRelease,
      version: '2026.08.29.1',
      publishedAt: '2026-08-29T11:00:00.000Z',
    };
    render(
      <DatasetProvider snapshot={current} historicalSnapshots={[historical]}>
        <ReleaseIndexConsumer />
      </DatasetProvider>,
    );

    expect(
      await screen.findByText(
        'Releases: 2026.08.29.1:bundled,2026.08.29.2:bundled',
      ),
    ).toBeVisible();
  });
});
