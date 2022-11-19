export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}
