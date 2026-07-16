import { mergeSearchResults } from "@/store/slices/searchResultsSlice";

describe("mergeSearchResults", () => {
  test("deduplicates identifiers present in both local and remote results", () => {
    const local = { key1: ["id-1", "id-2"] };
    const remote = { key1: ["id-2", "id-3"] };
    expect(mergeSearchResults(local, remote)).toEqual({
      key1: ["id-1", "id-2", "id-3"],
    });
  });

  test("merges non-overlapping results without duplication", () => {
    const local = { key1: ["id-1"] };
    const remote = { key1: ["id-2"] };
    expect(mergeSearchResults(local, remote)).toEqual({
      key1: ["id-1", "id-2"],
    });
  });

  test("merges disjoint keys", () => {
    const local = { key1: ["id-1"] };
    const remote = { key2: ["id-2"] };
    expect(mergeSearchResults(local, remote)).toEqual({
      key1: ["id-1"],
      key2: ["id-2"],
    });
  });
});
