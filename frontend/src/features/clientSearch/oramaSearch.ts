import { search } from "@orama/orama";

import { Printing } from "@/common/constants";
import { toSearchable } from "@/common/processing";
import { SearchSettings, SortBy } from "@/common/schema_types";
import {
  CardType,
  OramaIndex,
  OramaSearchResult,
  OramaSearchResults,
} from "@/common/types";

// Levenshtein edit distance applied per search term when the initial search
// finds nothing. 2 forgives most single-word misspellings without letting
// unrelated cards through.
const FALLBACK_TOLERANCE = 2;

export function searchOramaIndex(
  oramaIndex: OramaIndex | undefined,
  searchSettings: SearchSettings,
  query: string | undefined,
  cardTypes: Array<CardType>,
  sortBy?: SortBy,
  limit?: number,
  offset?: number,
  printings?: Array<Printing>,
  artists?: Array<string>,
): OramaSearchResults | undefined {
  if (oramaIndex?.oramaDb === undefined) {
    return undefined;
  }

  const includesTags = searchSettings.filterSettings.includesTags.length > 0;
  const excludesTags = searchSettings.filterSettings.excludesTags.length > 0;

  const sortByConfigs = {
    [SortBy.DateCreatedAscending]: {
      property: "createdNumber",
      order: "ASC",
    },
    [SortBy.DateCreatedDescending]: {
      property: "createdNumber",
      order: "DESC",
    },
    [SortBy.DateModifiedAscending]: {
      property: "lastModifiedNumber",
      order: "ASC",
    },
    [SortBy.DateModifiedDescending]: {
      property: "lastModifiedNumber",
      order: "DESC",
    },
    [SortBy.NameAscending]: { property: "searchq", order: "ASC" },
    [SortBy.NameDescending]: { property: "searchq", order: "DESC" },
  } as const;
  const sortByConfig = sortBy && sortByConfigs[sortBy];

  const runSearch = (options: {
    exact: boolean;
    tolerance?: number;
  }): OramaSearchResults => {
    const searchResults = search(oramaIndex.oramaDb, {
      term: query ? toSearchable(query) : undefined,
      properties: ["searchq"],
      limit: limit ?? 1_000_000, // some arbitrary upper limit. if undefined, orama limits to 10 results.
      offset: offset ?? 0,
      exact: options.exact,
      tolerance: options.tolerance,
      where: {
        and: [
          ...(cardTypes.length > 0 ? [{ cardType: { in: cardTypes } }] : []),
          {
            or: [
              ...searchSettings.sourceSettings.sources
                .filter((sourceRow) => sourceRow[1] === true)
                .map((sourceRow) => ({ sourceId: { eq: sourceRow[0] } })),
              { sourceId: { eq: -1 } },
            ],
          },
          ...(includesTags
            ? [
                {
                  tags: {
                    containsAny: searchSettings.filterSettings.includesTags,
                  },
                },
              ]
            : []),
          ...(excludesTags
            ? [
                {
                  not: {
                    tags: {
                      containsAny: searchSettings.filterSettings.excludesTags,
                    },
                  },
                },
              ]
            : []),
          {
            dpi: {
              between: [
                searchSettings.filterSettings.minimumDPI,
                searchSettings.filterSettings.maximumDPI,
              ],
            },
          },
          {
            size: {
              lte: searchSettings.filterSettings.maximumSize * 1_000_000,
            },
          },
          ...((printings?.length ?? 0) > 0
            ? [
                {
                  or: printings!.map(({ expansionCode, collectorNumber }) => ({
                    expansionCode: expansionCode,
                    collectorNumber: collectorNumber,
                  })),
                },
              ]
            : []),
          ...((artists?.length ?? 0) > 0 ? [{ artist: { in: artists } }] : []),
        ],
      },
      sortBy: sortByConfig,
    }) as {
      hits: Array<OramaSearchResult> | undefined;
      count: number | undefined;
    };
    return {
      hits: searchResults.hits ?? [],
      count: searchResults.count ?? 0,
    };
  };

  const primaryResults = runSearch({
    exact:
      query !== undefined && !searchSettings.searchTypeSettings.fuzzySearch,
  });
  if (primaryResults.count > 0 || !query) {
    return primaryResults;
  }
  // fuzzy fallback: the query found nothing, so retry once with typo
  // tolerance. all `where` filters still apply.
  try {
    return runSearch({ exact: false, tolerance: FALLBACK_TOLERANCE });
  } catch {
    return primaryResults;
  }
}
