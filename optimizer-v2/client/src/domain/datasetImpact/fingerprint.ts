import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import { projectRecommendationBuildInputs } from '../optimizer/planFingerprint';
import { canonicalJson, hashString } from './canonical';
import type { DatasetReleaseDescriptor } from './releaseIndex';

export const DATASET_IMPACT_CONTRACT_VERSION = 1 as const;

export function fingerprintBuildInputs(profile: CharacterProfile): string {
  return `build-input-${hashString(
    JSON.stringify(projectRecommendationBuildInputs(profile)),
  )}`;
}

export function fingerprintDatasetSnapshot(snapshot: DatasetSnapshot): string {
  return `dataset-${hashString(canonicalJson(snapshot))}`;
}

export function buildImpactKeyFingerprint(input: {
  inputFingerprint: string;
  pinned: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
}): string {
  return `impact-${hashString(
    canonicalJson({
      contractVersion: DATASET_IMPACT_CONTRACT_VERSION,
      inputFingerprint: input.inputFingerprint,
      pinnedVersion: input.pinned.version,
      pinnedContentFingerprint: input.pinned.contentFingerprint,
      targetVersion: input.target.version,
      targetContentFingerprint: input.target.contentFingerprint,
    }),
  )}`;
}
