jest.mock("comlink", () => ({ expose: jest.fn() }));
jest.mock("./indexer", () => ({
  Folder: class {},
  LocalFilesIndexer: class {},
  GoogleDriveIndexer: class {},
}));

import { SortBy } from "@/common/schema_types";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  defaultSettings,
} from "@/common/test-constants";
import { CardDocument } from "@/common/types";

import { ClientSearchService } from "./clientSearchService.worker";

// Three cards with distinct download counts across each time window so each
// sort produces a deterministic, unambiguous ordering.
//
//  card | today | week | month | allTime
//  1    |  5    |  10  |  20   |  100
//  2    |  10   |   5  |  30   |   50
//  3    |   1   |  20  |  10   |  200
const cards: CardDocument[] = [
  {
    ...cardDocument1,
    downloadsToday: 5,
    downloadsThisWeek: 10,
    downloadsThisMonth: 20,
    totalDownloads: 100,
  },
  {
    ...cardDocument2,
    downloadsToday: 10,
    downloadsThisWeek: 5,
    downloadsThisMonth: 30,
    totalDownloads: 50,
  },
  {
    ...cardDocument3,
    downloadsToday: 1,
    downloadsThisWeek: 20,
    downloadsThisMonth: 10,
    totalDownloads: 200,
  },
];

describe("ClientSearchService", () => {
  let service: ClientSearchService;

  beforeEach(() => {
    service = new ClientSearchService();
  });

  describe("filterGridSelectorIdentifiers — popularity sorting", () => {
    test.each([
      [
        SortBy.PopularityTodayDescending,
        [
          cardDocument2.identifier,
          cardDocument1.identifier,
          cardDocument3.identifier,
        ],
      ],
      [
        SortBy.PopularityWeekDescending,
        [
          cardDocument3.identifier,
          cardDocument1.identifier,
          cardDocument2.identifier,
        ],
      ],
      [
        SortBy.PopularityMonthDescending,
        [
          cardDocument2.identifier,
          cardDocument1.identifier,
          cardDocument3.identifier,
        ],
      ],
      [
        SortBy.PopularityAllTimeDescending,
        [
          cardDocument3.identifier,
          cardDocument1.identifier,
          cardDocument2.identifier,
        ],
      ],
    ])(
      "%s returns identifiers ordered by the matching download field descending",
      async (sortBy, expectedOrder) => {
        const result = await service.filterGridSelectorIdentifiers(
          cards,
          defaultSettings,
          sortBy,
          [],
          []
        );
        expect(result).toEqual(expectedOrder);
      }
    );
  });
});
