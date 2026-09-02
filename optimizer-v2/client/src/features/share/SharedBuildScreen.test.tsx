import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import {
  DatasetContext,
  DatasetProvider,
} from '../../app/providers/DatasetProvider';
import { ResolvedSharedBuild, SharedBuildView } from './SharedBuildScreen';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'shared:test',
  name: 'Shared Route',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 5,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: ['steel-greatsword'],
  datasetVersion: 'bootstrap-0',
};

describe('SharedBuildView', () => {
  it.each([
    [
      'overspent stats',
      { ...profile, stats: { str: 15, def: 0, agi: 3, vit: 7, luk: 0 } },
      'Invested stats exceed the available point budget by 1.',
    ],
    [
      'insufficient stat capacity',
      {
        ...profile,
        level: 834,
        stats: { str: 500, def: 500, agi: 500, vit: 500, luk: 500 },
      },
      'Current unspent points and the next ten levels require 32 open stat slots, but only 0 remain.',
    ],
  ])('shows unavailable without shared advice for %s', (_case, blockedProfile, explanation) => {
    render(
      <MemoryRouter>
        <SharedBuildView profile={blockedProfile} snapshot={bootstrapRelease} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Optimization unavailable' }),
    ).toBeVisible();
    expect(screen.getByText(explanation)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Do now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Next levels' })).not.toBeInTheDocument();
  });

  it('ignores recommendation text injected into the URL and recomputes locally', () => {
    const expected = optimizeBuild(profile, bootstrapRelease);
    render(
      <MemoryRouter
        initialEntries={[
          '/shared/test?recommendationText=Equip%20Admin%20Blade',
        ]}
      >
        <SharedBuildView profile={profile} snapshot={bootstrapRelease} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Equip Admin Blade')).not.toBeInTheDocument();
    expect(screen.getByText(expected.immediateAction.summary)).toBeVisible();
    expect(screen.getByText('Dataset bootstrap-0')).toBeVisible();
  });

  it('shows spend-now advice before the shared future stat plan', () => {
    render(
      <MemoryRouter>
        <SharedBuildView
          profile={{
            ...profile,
            stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
          }}
          snapshot={bootstrapRelease}
        />
      </MemoryRouter>,
    );

    const spendNow = screen.getByRole('region', { name: 'Spend now' });
    expect(within(spendNow).getByText('24 points available now')).toBeVisible();
    const futurePlan = screen.getByRole('table', { name: 'Next ten levels' });
    expect(
      spendNow.compareDocumentPosition(futurePlan) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(futurePlan).getByRole('rowheader', { name: 'Level 9' })).toBeVisible();
    expect(within(futurePlan).getByRole('rowheader', { name: 'Level 18' })).toBeVisible();
  });

  it('shows optimizer-provided requirements and confirmation guidance for future shared upgrades', () => {
    const steelGreatsword = bootstrapRelease.equipment.find(
      (item) => item.id === 'steel-greatsword',
    )!;
    const futureItem = {
      ...steelGreatsword,
      id: 'future-steel-greatsword',
      name: 'Future Steel Greatsword',
      attack: steelGreatsword.attack + 20,
      levelRequirement: 15,
      skillRequirement: 10,
    };

    render(
      <MemoryRouter>
        <SharedBuildView
          profile={{
            ...profile,
            weaponSkill: undefined,
            stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
          }}
          snapshot={{
            ...bootstrapRelease,
            equipment: [...bootstrapRelease.equipment, futureItem],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Future Steel Greatsword')).toBeVisible();
    expect(screen.getByText('Level 15 · Weapon Skill 10')).toBeVisible();
    expect(
      screen.getByText('Requires Level 15 · Requires Weapon Skill 10; confirm in game'),
    ).toBeVisible();
  });

  it('resolves the share dataset version instead of using the current release', async () => {
    const current = {
      ...bootstrapRelease,
      version: '2026.08.29.2',
      equipment: bootstrapRelease.equipment.filter(
        (item) => item.id !== 'steel-greatsword',
      ),
    };
    render(
      <MemoryRouter>
        <DatasetProvider
          snapshot={current}
          historicalSnapshots={[bootstrapRelease]}
        >
          <ResolvedSharedBuild
            shareId="test"
            build={{
              shareId: 'test',
              schemaVersion: profile.schemaVersion,
              name: profile.name!,
              level: profile.level,
              maxFloor: profile.maxFloor,
              weaponPath: profile.weaponPath,
              goal: profile.goal,
              weaponSkill: profile.weaponSkill,
              str: profile.stats.str,
              def: profile.stats.def,
              agi: profile.stats.agi,
              vit: profile.stats.vit,
              luk: profile.stats.luk,
              datasetVersion: profile.datasetVersion,
            }}
            equipment={Object.entries(profile.equipped).map(([slot, itemId]) => ({
              slot,
              itemId: itemId!,
            }))}
            ownedItems={profile.ownedItemIds.map((itemId) => ({ itemId }))}
          />
        </DatasetProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Equip Steel Greatsword now')).toBeVisible();
    expect(screen.getByText('Dataset bootstrap-0')).toBeVisible();
  });

  it('waits for the exact historical release and recomputes only when it arrives', async () => {
    let resolveExactRelease: (snapshot: typeof bootstrapRelease | null) => void;
    const requestedVersions: string[] = [];
    const exactRelease = new Promise<typeof bootstrapRelease | null>((resolve) => {
      resolveExactRelease = resolve;
    });
    const current = {
      ...bootstrapRelease,
      version: '2026.08.29.current',
      equipment: bootstrapRelease.equipment.filter(
        (item) => item.id !== 'steel-greatsword',
      ),
    };
    const getSnapshot = (version: string) => {
      requestedVersions.push(version);
      return version === profile.datasetVersion
        ? exactRelease
        : Promise.resolve(current);
    };

    render(
      <MemoryRouter>
        <DatasetContext.Provider
          value={{
            snapshot: current,
            source: 'bundled',
            getSnapshot,
            listReleases: async () => [],
          }}
        >
          <ResolvedSharedBuild
            shareId="historical-release"
            build={{
              shareId: 'historical-release',
              schemaVersion: profile.schemaVersion,
              name: profile.name!,
              level: profile.level,
              maxFloor: profile.maxFloor,
              weaponPath: profile.weaponPath,
              goal: profile.goal,
              weaponSkill: profile.weaponSkill,
              str: profile.stats.str,
              def: profile.stats.def,
              agi: profile.stats.agi,
              vit: profile.stats.vit,
              luk: profile.stats.luk,
              datasetVersion: profile.datasetVersion,
            }}
            equipment={Object.entries(profile.equipped).map(([slot, itemId]) => ({
              slot,
              itemId: itemId!,
            }))}
            ownedItems={profile.ownedItemIds.map((itemId) => ({ itemId }))}
          />
        </DatasetContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading verified dataset…')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Do now' })).not.toBeInTheDocument();
    expect(requestedVersions).toEqual([profile.datasetVersion]);

    await act(async () => {
      resolveExactRelease!(bootstrapRelease);
      await exactRelease;
    });

    expect(await screen.findByText('Equip Steel Greatsword now')).toBeVisible();
    expect(screen.getByText('Dataset bootstrap-0')).toBeVisible();
    expect(requestedVersions).toEqual([profile.datasetVersion]);
  });

  it.each([
    ['the requested release is absent', async () => null],
    ['the historical cache rejects the requested release', async () => {
      throw new Error('IndexedDB rejected the release');
    }],
  ])('shows unavailable instead of current advice when %s', async (_case, resolveExactVersion) => {
    const requestedVersions: string[] = [];
    const current = {
      ...bootstrapRelease,
      version: '2026.08.29.current',
      equipment: bootstrapRelease.equipment.filter(
        (item) => item.id !== 'steel-greatsword',
      ),
    };
    const getSnapshot = (version: string) => {
      requestedVersions.push(version);
      return version === profile.datasetVersion
        ? resolveExactVersion()
        : Promise.resolve(current);
    };
    render(
      <MemoryRouter>
        <DatasetContext.Provider
          value={{
            snapshot: current,
            source: 'bundled',
            getSnapshot,
            listReleases: async () => [],
          }}
        >
          <ResolvedSharedBuild
            shareId="missing-historical-release"
            build={{
              shareId: 'missing-historical-release',
              schemaVersion: profile.schemaVersion,
              name: profile.name!,
              level: profile.level,
              maxFloor: profile.maxFloor,
              weaponPath: profile.weaponPath,
              goal: profile.goal,
              weaponSkill: profile.weaponSkill,
              str: profile.stats.str,
              def: profile.stats.def,
              agi: profile.stats.agi,
              vit: profile.stats.vit,
              luk: profile.stats.luk,
              datasetVersion: profile.datasetVersion,
            }}
            equipment={Object.entries(profile.equipped).map(([slot, itemId]) => ({
              slot,
              itemId: itemId!,
            }))}
            ownedItems={profile.ownedItemIds.map((itemId) => ({ itemId }))}
          />
        </DatasetContext.Provider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Verified dataset bootstrap-0 is unavailable.',
      }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Do now' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dataset 2026.08.29.current')).not.toBeInTheDocument();
    expect(requestedVersions).toEqual([profile.datasetVersion]);
  });
});
