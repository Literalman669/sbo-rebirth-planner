export type ReleaseState = { version: string; isCurrent: boolean };

export function assertExactlyOneCurrentRelease(
  releases: readonly ReleaseState[],
): void {
  if (releases.filter((release) => release.isCurrent).length !== 1) {
    throw new Error('exactly one current dataset release required');
  }
}
