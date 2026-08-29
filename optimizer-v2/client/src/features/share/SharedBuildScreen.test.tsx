import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import { DatasetProvider } from '../../app/providers/DatasetProvider';
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
});
