import type { CharacterProfile } from '../build/model';
import { characterProfileSchema } from '../build/schema';
import { canonicalJson } from './canonical';

function withoutDatasetVersion(profile: CharacterProfile) {
  const { datasetVersion: _datasetVersion, ...rest } = profile;
  return rest;
}

export function assertDatasetPinOnlyUpdate(
  before: CharacterProfile,
  after: CharacterProfile,
): void {
  const validBefore = characterProfileSchema.parse(before);
  const validAfter = characterProfileSchema.parse(after);
  if (validBefore.datasetVersion === validAfter.datasetVersion) {
    throw new Error('datasetVersion must change');
  }
  if (
    canonicalJson(withoutDatasetVersion(validBefore)) !==
    canonicalJson(withoutDatasetVersion(validAfter))
  ) {
    throw new Error('only datasetVersion may change');
  }
}

export function createDatasetPinnedProfile(
  profile: CharacterProfile,
  targetDatasetVersion: string,
): CharacterProfile {
  const updated = characterProfileSchema.parse({
    ...structuredClone(profile),
    datasetVersion: targetDatasetVersion,
  });
  assertDatasetPinOnlyUpdate(profile, updated);
  return updated;
}
