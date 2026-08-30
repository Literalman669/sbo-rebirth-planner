import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../../domain/build/model';
import { EquipmentPicker } from './EquipmentPicker';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'picker-build',
  level: 20,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  weaponSkill: 20,
  stats: { str: 20, def: 10, agi: 10, vit: 10, luk: 10 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: [],
  datasetVersion: fallbackRelease.version,
};

function Harness() {
  const [value, setValue] = useState<string | undefined>('beginner-armor');
  return (
    <EquipmentPicker
      slot="armor"
      label="Armor"
      required
      profile={{ ...profile, equipped: { ...profile.equipped, armor: value } }}
      snapshot={fallbackRelease}
      value={value}
      onSelect={setValue}
    />
  );
}

describe('EquipmentPicker', () => {
  it('searches, compares, and equips from one focused dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Change Armor' }));
    await user.clear(screen.getByRole('searchbox', { name: 'Search Armor' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search Armor' }),
      'Combat Armor',
    );
    expect(await screen.findByText('DEF +3 · DEX +15')).toBeVisible();
    expect(screen.getByText('3,360 Col')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Equip Combat Armor' }),
    );

    expect(screen.getByRole('button', { name: 'Change Armor' })).toHaveTextContent(
      'Combat Armor',
    );
  });
});
