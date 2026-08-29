type FillRandomBytes = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

export function generateShareId(
  fillRandomBytes: FillRandomBytes = (bytes) => crypto.getRandomValues(bytes),
): string {
  const bytes = fillRandomBytes(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
