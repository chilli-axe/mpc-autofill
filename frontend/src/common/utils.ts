import { Brackets, ReversedCardTypePrefixes } from "@/common/constants";
import { SearchQuery, SourceRow, SourceSettings } from "@/common/types";

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

/**
 * Format `size` (a size in bytes) as a string in megabytes.
 */
export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}

/**
 * Calculate the MPC bracket that `projectSize` falls into.
 */
export function bracket(projectSize: number): number {
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

export function stringifySearchQuery(searchQuery: SearchQuery): string {
  return searchQuery.cardType != null
    ? `${ReversedCardTypePrefixes[searchQuery.cardType]}${searchQuery.query}`
    : "";
}

export function getSourceRowsFromSourceSettings(
  sourceSettings: SourceSettings
): Array<SourceRow> {
  return (sourceSettings.sources ?? []).map((item) => [
    Number(item[0]),
    item[1] === true,
  ]);
}

export const assertUnreachable = (x: never): never => {
  throw new Error(`Didn't expect to get here with ${x}`);
};
