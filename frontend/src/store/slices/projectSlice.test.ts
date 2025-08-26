import { CardType, ThunkStatus } from "@/common/types";
import { selectQueriesWithoutSearchResults } from "@/store/slices/projectSlice";
import { setupStore } from "@/store/store";

describe("selectQueriesWithoutSearchResults tests", () => {
  test("empty", () => {
    const state = {
      project: { members: [], cardback: null, mostRecentlySelectedSlot: null },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([]);
  });

  test("one query", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {},
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([{ query: "query 1", cardType: "CARD" }]);
  });

  test("two queries", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
          {
            front: {
              query: {
                query: "query 2",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {},
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([
      { query: "query 1", cardType: "CARD" },
      { query: "query 2", cardType: "CARD" },
    ]);
  });

  test("three queries", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
          {
            front: {
              query: {
                query: "query 2",
                cardType: "TOKEN" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: {
              query: {
                query: "query 3",
                cardType: "CARDBACK" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {},
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([
      { query: "query 1", cardType: "CARD" },
      { query: "query 2", cardType: "TOKEN" },
      { query: "query 3", cardType: "CARDBACK" },
    ]);
  });

  test("two queries but one has search results", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
          {
            front: {
              query: {
                query: "query 2",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {
          "query 1": { CARD: [], CARDBACK: [], TOKEN: [] },
        },
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([{ query: "query 2", cardType: "CARD" }]);
  });

  test("duplicated query", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {},
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([{ query: "query 1", cardType: "CARD" }]);
  });

  test("duplicated query but across multiple types", () => {
    const state = {
      project: {
        members: [
          {
            front: {
              query: {
                query: "query 1",
                cardType: "CARD" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
          {
            front: {
              query: {
                query: "query 1",
                cardType: "TOKEN" as CardType,
              },
              selectedImage: undefined,
              selected: false,
            },
            back: null,
          },
        ],
        cardback: null,
        mostRecentlySelectedSlot: null,
      },
      searchResults: {
        searchResults: {},
        status: "idle" as ThunkStatus,
        error: null,
      },
    };
    expect(
      selectQueriesWithoutSearchResults(setupStore(state).getState())
    ).toStrictEqual([
      { query: "query 1", cardType: "CARD" },
      { query: "query 1", cardType: "TOKEN" },
    ]);
  });
});
