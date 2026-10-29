import { search } from "@orama/orama";

import { CardType as CardTypeSchema, SourceType } from "@/common/schema_types";
import { OramaCardDocument } from "@/common/types";

import { buildOramaIndex } from "./buildOramaIndex";

const buildDocument = (name: string): OramaCardDocument => ({
  id: name,
  name,
  searchq: name.toLowerCase(),
  source: "test",
  sourceId: -1,
  sourceVerbose: "Test",
  cardType: CardTypeSchema.Card,
  extension: "png",
  language: "EN",
  tags: [],
  dpi: 600,
  size: 1,
  lastModified: new Date(2020, 0, 1),
  lastModifiedNumber: new Date(2020, 0, 1).valueOf(),
  created: new Date(2020, 0, 1),
  createdNumber: new Date(2020, 0, 1).valueOf(),
  expansionCode: "UNK",
  collectorNumber: "UNK",
  artist: "Unknown",
  params: {
    sourceType: SourceType.GoogleDrive,
    identifier: name,
    fileHandle: undefined,
  },
});

describe("buildOramaIndex", () => {
  test("builds a searchable index from persisted documents", async () => {
    const index = buildOramaIndex([
      buildDocument("Lightning Bolt"),
      buildDocument("Counterspell"),
    ]);
    expect(index.size).toBe(2);
    const results = search(index.oramaDb, {
      term: "counterspell",
      properties: ["searchq"],
    }) as { count: number };
    expect(results.count).toBe(1);
  });

  test("builds an empty index from no documents", () => {
    expect(buildOramaIndex([]).size).toBe(0);
  });
});
