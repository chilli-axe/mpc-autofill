export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}
