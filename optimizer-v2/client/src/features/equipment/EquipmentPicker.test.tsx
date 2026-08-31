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
  it('labels the saved selection as currently equipped even when entered requirements are incomplete', async () => {
    const user = userEvent.setup();
    render(
      <EquipmentPicker
        slot="main-hand"
        label="Main-hand weapon"
        required
        profile={{ ...profile, weaponSkill: undefined }}
        snapshot={fallbackRelease}
        value="iron-greatsword"
        onSelect={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Change Main-hand weapon' }));
    expect(await screen.findAllByText('Currently equipped')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Currently equipped Iron Greatsword' })).toBeDisabled();
    expect(screen.getByText('Requires Weapon Skill 1')).toBeVisible();
  });

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
