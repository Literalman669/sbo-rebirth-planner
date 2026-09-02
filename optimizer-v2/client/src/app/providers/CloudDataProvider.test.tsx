import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from './AuthContext';
import { AuthSessionContext } from './AuthContext';
import { CloudDataProvider } from './CloudDataProvider';
import { useCloudData } from './CloudDataContext';

const spacetime = vi.hoisted(() => ({
  useTable: vi.fn(
    (_table: unknown): readonly [readonly unknown[], boolean] => [[], true],
  ),
}));

vi.mock('spacetimedb/react', () => ({
  SpacetimeDBProvider: ({ children }: { children: React.ReactNode }) => children,
  useTable: spacetime.useTable,
}));

vi.mock('../../infrastructure/spacetime/connection', () => ({
  createConnectionBuilder: vi.fn(() => ({ kind: 'connection-builder' })),
}));

const noop = async () => undefined;

function Probe() {
  const cloud = useCloudData();
  return (
    <p>
      {cloud.isAuthenticated ? 'authenticated' : 'guest'} ·{' '}
      {cloud.isReady ? 'ready' : 'waiting'} · {cloud.builds.length} builds ·{' '}
      {cloud.planProgress.length} progress ·{' '}
      {cloud.preferences?.density ?? 'no preferences'} ·{' '}
      {cloud.inventory?.ownedItemIds.length ?? 0} inventory ·{' '}
      {cloud.datasetReviews.length} reviews
    </p>
  );
}

function renderCloud(session: AuthSession) {
  return render(
    <AuthSessionContext.Provider value={session}>
      <CloudDataProvider>
        <Probe />
      </CloudDataProvider>
    </AuthSessionContext.Provider>,
  );
}

beforeEach(() => spacetime.useTable.mockClear());

describe('CloudDataProvider', () => {
  it('does not subscribe to private views for guests', () => {
    renderCloud({ status: 'guest', signIn: noop, signOut: noop });

    expect(
      screen.getByText(
        'guest · ready · 0 builds · 0 progress · no preferences · 0 inventory · 0 reviews',
      ),
    ).toBeVisible();
    expect(spacetime.useTable).not.toHaveBeenCalled();
  });

  it('subscribes to all identity-filtered views after authentication', () => {
    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(
      screen.getByText(
        'authenticated · ready · 0 builds · 0 progress · no preferences · 0 inventory · 0 reviews',
      ),
    ).toBeVisible();
    expect(spacetime.useTable).toHaveBeenCalledTimes(9);
  });

  it('validates subscribed progress and preferences before exposing them', () => {
    spacetime.useTable
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [[], true])
      .mockImplementationOnce(() => [
        [
          {
            buildId: 'build-a',
            progressJson: JSON.stringify({
              schemaVersion: 1,
              buildId: 'build-a',
              completedActionIds: [],
              dismissedRecommendationIds: [],
            }),
          },
        ],
        true,
      ])
      .mockImplementationOnce(() => [
        [
          {
            preferencesJson: JSON.stringify({
              schemaVersion: 1,
              mode: 'detailed',
              density: 'compact',
              showAllLevels: true,
              compactWeaponPathsAfterFirstUse: true,
            }),
          },
        ],
        true,
      ])
      .mockImplementationOnce(() => [
        [
          {
            inventoryJson: JSON.stringify({
              schemaVersion: 1,
              ownedItemIds: ['iron-greatsword'],
              favoriteItemIds: [],
              comparisonItemIds: [],
              notes: {},
            }),
          },
        ],
        true,
      ])
      .mockImplementationOnce(() => [[], true]);

    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(
      screen.getByText(
        'authenticated · ready · 0 builds · 1 progress · compact · 1 inventory · 0 reviews',
      ),
    ).toBeVisible();
  });

  it('hydrates private dataset reviews without changing build or progress state', () => {
    const receipt = {
      schemaVersion: 1,
      buildId: 'build-a',
      inputFingerprint: 'input-a',
      pinnedDatasetVersion: 'bootstrap-0',
      targetDatasetVersion: '2026.09.01.1',
      impactKeyFingerprint: 'impact-a',
      reportFingerprint: 'report-a',
      status: 'reviewed',
      reviewedAt: '2026-09-01T12:00:00.000Z',
    };
    for (let index = 0; index < 8; index += 1) {
      spacetime.useTable.mockImplementationOnce(() => [[], true]);
    }
    spacetime.useTable.mockImplementationOnce(() => [[{
      buildId: 'build-a',
      receiptJson: JSON.stringify(receipt),
    }], true]);

    renderCloud({
      status: 'authenticated',
      idToken: 'signed-id-token',
      signIn: noop,
      signOut: noop,
    });

    expect(screen.getByText(
      'authenticated · ready · 0 builds · 0 progress · no preferences · 0 inventory · 1 reviews',
    )).toBeVisible();
  });

  it('does not retain one account review when the authenticated subject changes', () => {
    const validReceipt = JSON.stringify({
      schemaVersion: 1,
      buildId: 'build-a',
      inputFingerprint: 'input-a',
      pinnedDatasetVersion: 'bootstrap-0',
      targetDatasetVersion: '2026.09.01.1',
      impactKeyFingerprint: 'impact-a',
      reportFingerprint: 'report-a',
      status: 'reviewed',
      reviewedAt: '2026-09-01T12:00:00.000Z',
    });
    for (let index = 0; index < 8; index += 1) {
      spacetime.useTable.mockImplementationOnce(() => [[], true]);
    }
    spacetime.useTable.mockImplementationOnce(() => [[{
      buildId: 'build-a',
      receiptJson: validReceipt,
    }], true]);
    const view = renderCloud({
      status: 'authenticated',
      subject: 'account-a',
      idToken: 'account-a-token',
      signIn: noop,
      signOut: noop,
    });
    expect(screen.getByText(/1 reviews/)).toBeVisible();

    spacetime.useTable.mockReset();
    spacetime.useTable.mockImplementation(
      (_table: unknown): readonly [readonly unknown[], boolean] => [[], true],
    );
    let call = 0;
    spacetime.useTable.mockImplementation(() => {
      call += 1;
      return call % 9 === 0
        ? [[{ buildId: 'build-a', receiptJson: '{"schemaVersion":99}' }], true]
        : [[], true];
    });
    view.rerender(
      <AuthSessionContext.Provider value={{
        status: 'authenticated',
        subject: 'account-b',
        idToken: 'account-b-token',
        signIn: noop,
        signOut: noop,
      }}>
        <CloudDataProvider>
          <Probe />
        </CloudDataProvider>
      </AuthSessionContext.Provider>,
    );

    expect(screen.getByText(/0 reviews/)).toBeVisible();
  });
});
