export function isPlanStale(
  planVersion: string,
  currentVersion: string,
): boolean {
  return planVersion !== currentVersion;
}
