import { setupStore } from "@/app/store";
import { CardType, ThunkStatus } from "@/common/types";
import { selectQueriesWithoutSearchResults } from "@/features/project/projectSlice";

test("selectQueriesWithoutSearchResults empty", () => {
  const state = { project: { members: [], cardback: null } };
  expect(
    selectQueriesWithoutSearchResults(setupStore(state).getState())
  ).toStrictEqual([]);
});

test("selectQueriesWithoutSearchResults one query", () => {
  const state = {
    project: {
      members: [
        {
          front: {
            query: {
              query: "query 1",
              card_type: "CARD" as CardType,
            },
            selectedImage: undefined,
            selected: false,
          },
          back: null,
        },
      ],
      cardback: null,
    },
    searchResults: {
      searchResults: {},
      status: "idle" as ThunkStatus,
      error: null,
    },
  };
  expect(
    selectQueriesWithoutSearchResults(setupStore(state).getState())
  ).toStrictEqual([{ query: "query 1", card_type: "CARD" }]);
});

test("selectQueriesWithoutSearchResults two queries", () => {
  const state = {
    project: {
      members: [
        {
          front: {
            query: {
              query: "query 1",
              card_type: "CARD" as CardType,
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
              card_type: "CARD" as CardType,
            },
            selectedImage: undefined,
            selected: false,
          },
          back: null,
        },
      ],
      cardback: null,
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
    { query: "query 1", card_type: "CARD" },
    { query: "query 2", card_type: "CARD" },
  ]);
});

test("selectQueriesWithoutSearchResults three queries", () => {
  const state = {
    project: {
      members: [
        {
          front: {
            query: {
              query: "query 1",
              card_type: "CARD" as CardType,
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
              card_type: "TOKEN" as CardType,
            },
            selectedImage: undefined,
            selected: false,
          },
          back: {
            query: {
              query: "query 3",
              card_type: "CARDBACK" as CardType,
            },
            selectedImage: undefined,
            selected: false,
          },
        },
      ],
      cardback: null,
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
    { query: "query 1", card_type: "CARD" },
    { query: "query 2", card_type: "TOKEN" },
    { query: "query 3", card_type: "CARDBACK" },
  ]);
});

test("selectQueriesWithoutSearchResults two queries but one has search results", () => {
  const state = {
    project: {
      members: [
        {
          front: {
            query: {
              query: "query 1",
              card_type: "CARD" as CardType,
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
              card_type: "CARD" as CardType,
            },
            selectedImage: undefined,
            selected: false,
          },
          back: null,
        },
      ],
      cardback: null,
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
  ).toStrictEqual([{ query: "query 2", card_type: "CARD" }]);
});
