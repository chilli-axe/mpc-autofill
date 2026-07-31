import { create, insertMultiple } from "@orama/orama";

import { toSearchable } from "@/common/processing";
import { CardType as CardTypeSchema, SourceType } from "@/common/schema_types";
import {
  OramaCardDocument,
  OramaIndex,
  OramaSchema,
  SearchSettings,
} from "@/common/types";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";

import { searchOramaIndices } from "./oramaSearch";

const buildCardDocument = (
  name: string,
  overrides: Partial<OramaCardDocument> = {}
): OramaCardDocument => ({
  id: name,
  name,
  searchq: toSearchable(name),
  source: "test-source",
  sourceId: -1,
  sourceVerbose: "Test Source",
  cardType: CardTypeSchema.Card,
  extension: "png",
  language: "EN",
  tags: [],
  dpi: 600,
  size: 1_000_000,
  lastModified: new Date(2020, 0, 1),
  lastModifiedNumber: new Date(2020, 0, 1).valueOf(),
  created: new Date(2020, 0, 1),
  createdNumber: new Date(2020, 0, 1).valueOf(),
  expansionCode: "UNK",
  collectorNumber: "UNK",
  artist: "Test Artist",
  params: {
    sourceType: SourceType.GoogleDrive,
    identifier: name,
    fileHandle: undefined,
  },
  ...overrides,
});

const buildIndex = async (
  documents: Array<OramaCardDocument>
): Promise<OramaIndex> => {
  const oramaDb = await create({
    schema: OramaSchema,
    sort: {
      enabled: true,
      unsortableProperties: [
        "id",
        "name",
        "cardType",
        "extension",
        "language",
        "tags",
        "dpi",
        "size",
      ],
    },
  });
  await insertMultiple(oramaDb, documents);
  return { oramaDb, size: documents.length };
};

const preciseSettings = (): SearchSettings =>
  getDefaultSearchSettings({}, false);

const searchNames = (
  indices: OramaIndex | Array<OramaIndex | undefined>,
  settings: SearchSettings,
  query: string
): Array<string> =>
  searchOramaIndices(
    Array.isArray(indices) ? indices : [indices],
    settings,
    query,
    [CardTypeSchema.Card]
  ).hits.map((hit) => hit.document.name);

describe("searchOramaIndex fuzzy fallback", () => {
  let index: OramaIndex;

  beforeEach(async () => {
    index = await buildIndex([
      buildCardDocument("Lightning Bolt"),
      buildCardDocument("Lightning Helix"),
      buildCardDocument("Counterspell"),
    ]);
  });

  test("finds card despite a typo in every word", async () => {
    expect(searchNames(index, preciseSettings(), "lightnig bol")).toContain(
      "Lightning Bolt"
    );
  });

  test("finds card despite a typo in a single-word query", async () => {
    expect(searchNames(index, preciseSettings(), "counterspel")).toContain(
      "Counterspell"
    );
  });

  test("finds card when query contains extra words", async () => {
    expect(
      searchNames(index, preciseSettings(), "the lightning bolt card")
    ).toContain("Lightning Bolt");
  });

  test("finds card from a partial name", async () => {
    expect(searchNames(index, preciseSettings(), "bolt")).toContain(
      "Lightning Bolt"
    );
  });

  test("exact query returns only the exactly-matching card", async () => {
    expect(searchNames(index, preciseSettings(), "lightning bolt")).toEqual([
      "Lightning Bolt",
    ]);
  });

  test("fallback does not bypass tag exclusion filters", async () => {
    const settings = preciseSettings();
    // default settings exclude the NSFW tag
    const taggedIndex = await buildIndex([
      buildCardDocument("Lightning Bolt", { tags: ["NSFW"] }),
    ]);
    expect(searchNames(taggedIndex, settings, "lightnig bol")).toEqual([]);
  });

  test("fallback does not bypass DPI filters", async () => {
    const lowDpiIndex = await buildIndex([
      buildCardDocument("Lightning Bolt", { dpi: 100 }),
    ]);
    const settings = preciseSettings();
    settings.filterSettings.minimumDPI = 300;
    expect(searchNames(lowDpiIndex, settings, "lightnig bol")).toEqual([]);
  });

  test("returns empty results when no indices are defined", () => {
    expect(
      searchOramaIndices([undefined], preciseSettings(), "bolt", [
        CardTypeSchema.Card,
      ])
    ).toEqual({ hits: [], count: 0 });
  });

  describe("multiple indices", () => {
    let indexA: OramaIndex;
    let indexB: OramaIndex;

    beforeEach(async () => {
      indexA = await buildIndex([buildCardDocument("Lightning Bolt")]);
      indexB = await buildIndex([buildCardDocument("Lightning Belt")]);
    });

    test("an exact hit in one index suppresses fuzzy matches from the others", async () => {
      expect(
        searchNames([indexA, indexB], preciseSettings(), "lightning bolt")
      ).toEqual(["Lightning Bolt"]);
    });

    test("fallback fires across all indices when none has an exact hit", async () => {
      const names = searchNames(
        [indexA, indexB],
        preciseSettings(),
        "lightnig bol"
      );
      expect(names).toContain("Lightning Bolt");
      expect(names).toContain("Lightning Belt");
    });
  });
});
