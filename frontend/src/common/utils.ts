import { Brackets } from "@/common/constants";

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  /**
   * Format `size` (a size in bytes) as a string in megabytes.
   */

  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}

export function bracket(projectSize: number): number {
  /**
   * Calculate the MPC bracket that `projectSize` falls into.
   */

  for (const bracket of Brackets) {
    if (bracket >= projectSize) {
      return bracket;
    }
  }
  return Brackets[Brackets.length - 1];
}

export function toTitleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
