import {
  CURATED_PRESET_POLICY_VERSION,
  type CuratedBuildPreset,
} from '../domain/build/presets';

export const curatedBuildPresets: readonly CuratedBuildPreset[] = [
  {
    id: 'balanced-two-handed',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Two-Handed Start',
    weaponPath: 'two-handed',
    goal: 'balanced',
    description: 'A guided balanced start for two-handed weapons.',
  },
  {
    id: 'balanced-one-handed',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced One-Handed Start',
    weaponPath: 'one-handed',
    goal: 'balanced',
    description: 'A guided balanced start for one-handed weapons.',
  },
  {
    id: 'balanced-rapier',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Rapier Start',
    weaponPath: 'rapier',
    goal: 'balanced',
    description: 'A guided balanced start for rapier weapons.',
  },
  {
    id: 'balanced-dagger',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Dagger Start',
    weaponPath: 'dagger',
    goal: 'balanced',
    description: 'A guided balanced start for dagger weapons.',
  },
  {
    id: 'balanced-dual-wield',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Dual Wield Start',
    weaponPath: 'dual-wield',
    goal: 'balanced',
    description: 'A guided balanced start for dual-wield weapons.',
  },
  {
    id: 'balanced-melee',
    policyVersion: CURATED_PRESET_POLICY_VERSION,
    name: 'Balanced Melee Start',
    weaponPath: 'melee',
    goal: 'balanced',
    description: 'A guided balanced start for melee.',
  },
];
