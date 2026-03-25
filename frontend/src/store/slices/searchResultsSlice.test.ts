import { mergeSearchResults } from "@/store/slices/searchResultsSlice";

describe("mergeSearchResults", () => {
  test("deduplicates identifiers present in both local and remote results", () => {
    const local = { "my query": { CARD: ["id-1", "id-2"] } };
    const remote = { "my query": { CARD: ["id-2", "id-3"] } };
    expect(mergeSearchResults(local, remote)).toEqual({
      "my query": { CARD: ["id-1", "id-2", "id-3"] },
    });
  });

  test("merges non-overlapping results without duplication", () => {
    const local = { "my query": { CARD: ["id-1"] } };
    const remote = { "my query": { CARD: ["id-2"] } };
    expect(mergeSearchResults(local, remote)).toEqual({
      "my query": { CARD: ["id-1", "id-2"] },
    });
  });

  test("merges disjoint queries", () => {
    const local = { "query a": { CARD: ["id-1"] } };
    const remote = { "query b": { CARD: ["id-2"] } };
    expect(mergeSearchResults(local, remote)).toEqual({
      "query a": { CARD: ["id-1"] },
      "query b": { CARD: ["id-2"] },
    });
  });
});
