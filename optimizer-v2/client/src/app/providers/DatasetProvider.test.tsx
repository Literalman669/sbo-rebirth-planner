import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DatasetProvider,
  useDataset,
} from './DatasetProvider';

function DatasetConsumer() {
  const { snapshot, source } = useDataset();
  return <p>{snapshot.version} · {source}</p>;
}

describe('DatasetProvider', () => {
  it('exposes the validated bundled dataset', () => {
    render(
      <DatasetProvider>
        <DatasetConsumer />
      </DatasetProvider>,
    );

    expect(screen.getByText('bootstrap-0 · bundled')).toBeVisible();
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
});
