import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import { SharedBuildView } from './SharedBuildScreen';

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
});
