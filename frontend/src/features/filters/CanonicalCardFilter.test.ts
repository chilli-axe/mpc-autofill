import { Printing, Unknown } from "@/common/constants";

import { resolveSelectedPrintings } from "./CanonicalCardFilter";

type ExpansionEntry = { code: string; numbers: string[] };

function makeExpansionMap(
  entries: Array<[string, ExpansionEntry]>
): Map<string, { code: string; numbers: Set<string> }> {
  return new Map(
    entries.map(([key, { code, numbers }]) => [
      key,
      { code, numbers: new Set(numbers) },
    ])
  );
}

function nodes(...values: string[]): Array<{ value: string }> {
  return values.map((v) => ({ value: v }));
}

describe("resolveSelectedPrintings", () => {
  describe("empty selection", () => {
    test("returns an empty array when no nodes are selected", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001"] }],
      ]);
      expect(resolveSelectedPrintings([], map)).toEqual([]);
    });
  });

  describe("Unknown node", () => {
    test("returns the Unknown printing when the Unknown node is selected", () => {
      const map = makeExpansionMap([]);
      expect(resolveSelectedPrintings(nodes(Unknown), map)).toEqual<
        Array<Printing>
      >([{ expansionCode: Unknown, collectorNumber: Unknown }]);
    });

    test("selecting Unknown multiple times produces a single entry (deduplication)", () => {
      const map = makeExpansionMap([]);
      const result = resolveSelectedPrintings(nodes(Unknown, Unknown), map);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Printing>({
        expansionCode: Unknown,
        collectorNumber: Unknown,
      });
    });
  });

  describe("parent expansion node", () => {
    test("selecting a parent node expands to all collector numbers in that expansion", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002", "003"] }],
      ]);
      const result = resolveSelectedPrintings(nodes("xyz"), map);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "002",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "003",
      });
    });

    test("selecting a parent node with a single collector number returns one printing", () => {
      const map = makeExpansionMap([
        ["abc", { code: "abc", numbers: ["042"] }],
      ]);
      expect(resolveSelectedPrintings(nodes("abc"), map)).toEqual<
        Array<Printing>
      >([{ expansionCode: "abc", collectorNumber: "042" }]);
    });

    test("selecting two parent nodes returns all collector numbers from both expansions", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002"] }],
        ["abc", { code: "abc", numbers: ["010"] }],
      ]);
      const result = resolveSelectedPrintings(nodes("xyz", "abc"), map);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "002",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "abc",
        collectorNumber: "010",
      });
    });

    test("selecting a parent node not present in the expansion map is treated as a child node", () => {
      // A value not in the map and containing a space is parsed as a child node.
      // A value with no space is ignored entirely.
      const map = makeExpansionMap([]);
      expect(resolveSelectedPrintings(nodes("unknown-expansion"), map)).toEqual(
        []
      );
    });
  });

  describe("child collector-number nodes", () => {
    test("selecting a child node returns exactly that printing", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002"] }],
      ]);
      expect(resolveSelectedPrintings(nodes("xyz 001"), map)).toEqual<
        Array<Printing>
      >([{ expansionCode: "xyz", collectorNumber: "001" }]);
    });

    test("selecting multiple children from the same expansion returns all selected", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002", "003"] }],
      ]);
      const result = resolveSelectedPrintings(nodes("xyz 001", "xyz 003"), map);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "003",
      });
    });

    test("selecting children from different expansions returns all selected", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001"] }],
        ["abc", { code: "abc", numbers: ["010"] }],
      ]);
      const result = resolveSelectedPrintings(nodes("xyz 001", "abc 010"), map);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "abc",
        collectorNumber: "010",
      });
    });

    test("only the first space is used as the separator, preserving spaces in collector numbers", () => {
      // collector number "10 001" contains a space; child node value is "xyz 10 001"
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["10 001"] }],
      ]);
      expect(resolveSelectedPrintings(nodes("xyz 10 001"), map)).toEqual<
        Array<Printing>
      >([{ expansionCode: "xyz", collectorNumber: "10 001" }]);
    });

    test("a child node value with no space is silently ignored", () => {
      const map = makeExpansionMap([]);
      expect(resolveSelectedPrintings(nodes("nospace"), map)).toEqual([]);
    });
  });

  describe("deduplication", () => {
    test("selecting both a parent node and its children produces no duplicates", () => {
      // The library may emit both the parent expansion node AND each child when
      // all children are checked.
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002"] }],
      ]);
      const result = resolveSelectedPrintings(
        nodes("xyz", "xyz 001", "xyz 002"),
        map
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "002",
      });
    });

    test("selecting the same child node twice produces a single entry", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001"] }],
      ]);
      const result = resolveSelectedPrintings(nodes("xyz 001", "xyz 001"), map);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
    });

    test("selecting two parent nodes with overlapping collector numbers produces no duplicates", () => {
      // Edge case: if both a parent and a separate child node reference the same
      // printing via different paths, deduplication keeps only one entry.
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001"] }],
      ]);
      // "xyz" expands to xyz/001; "xyz 001" is the same printing.
      const result = resolveSelectedPrintings(nodes("xyz", "xyz 001"), map);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
    });
  });

  describe("mixed node types", () => {
    test("Unknown combined with expansion parent and child nodes all resolve correctly", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001"] }],
      ]);
      // parent "xyz" and child "xyz 001" deduplicate to a single xyz/001 entry
      const result = resolveSelectedPrintings(
        nodes(Unknown, "xyz", "xyz 001"),
        map
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual<Printing>({
        expansionCode: Unknown,
        collectorNumber: Unknown,
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
    });

    test("Unknown combined with children from multiple expansions", () => {
      const map = makeExpansionMap([
        ["xyz", { code: "xyz", numbers: ["001", "002"] }],
        ["abc", { code: "abc", numbers: ["010"] }],
      ]);
      const result = resolveSelectedPrintings(
        nodes(Unknown, "xyz 001", "abc 010"),
        map
      );
      expect(result).toHaveLength(3);
      expect(result).toContainEqual<Printing>({
        expansionCode: Unknown,
        collectorNumber: Unknown,
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "xyz",
        collectorNumber: "001",
      });
      expect(result).toContainEqual<Printing>({
        expansionCode: "abc",
        collectorNumber: "010",
      });
    });
  });
});
