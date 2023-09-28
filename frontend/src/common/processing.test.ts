import each from "jest-each";

import { Card, Cardback, Token } from "@/common/constants";
import {
  processLine,
  processPrefix,
  processQuery,
  processStringAsMultipleLines,
  sanitiseWhitespace,
  standardiseURL,
  stripTextInParentheses,
} from "@/common/processing";
import { DFCPairs } from "@/common/types";

// # region constants

const dfcPairs: DFCPairs = {
  "delver of secrets": "insectile aberration",
  "huntmaster of the fells": "ravager of the fells",
};

// # endregion

// # region tests

test("whitespace is sanitised correctly", () => {
  expect(sanitiseWhitespace(" my  doubled    whitespace ")).toBe(
    "my doubled whitespace"
  );
});

test("text is stripped in parentheses", () => {
  expect(stripTextInParentheses("my text (with text in) parentheses")).toBe(
    "my text parentheses"
  );
});

test("text is not stripped in nested parentheses", () => {
  expect(
    stripTextInParentheses("my text (with text in (nested)) parentheses")
  ).toBe("my text ) parentheses");
});

test("query with punctuation is processed correctly", () => {
  expect(processQuery("Isamaru, Hound of Konda ")).toBe(
    "isamaru hound of konda"
  );
});

test("query with numbers is processed correctly", () => {
  expect(processQuery("Borrowing 100,000 Arrows")).toBe(
    "borrowing 100000 arrows"
  );
});

test("prefix is processed correctly", () => {
  expect(processPrefix("t:goblin")).toStrictEqual({
    card_type: Token,
    query: "goblin",
  });
});

test("empty prefix is processed correctly", () => {
  expect(processPrefix("soldier")).toStrictEqual({
    card_type: Card,
    query: "soldier",
  });
});

test("line that doesn't specify quantity is processed correctly", () => {
  expect(processLine("opt", dfcPairs, false)).toStrictEqual([
    1,
    {
      query: { card_type: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that doesn't specify quantity but name begins with X is processed correctly", () => {
  expect(processLine("xenagos the reveler", dfcPairs, false)).toStrictEqual([
    1,
    {
      query: { card_type: Card, query: "xenagos the reveler" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("non-dfc line is processed correctly", () => {
  expect(processLine("3x Lightning Bolt", dfcPairs, false)).toStrictEqual([
    3,
    {
      query: { card_type: Card, query: "lightning bolt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("non-dfc cardback line is processed correctly", () => {
  expect(processLine("3x b:Black Lotus", dfcPairs, false)).toStrictEqual([
    3,
    {
      query: { card_type: Cardback, query: "black lotus" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("manually specified front and back line is processed correctly", () => {
  expect(processLine("5 Opt | Char", dfcPairs, false)).toStrictEqual([
    5,
    {
      query: { card_type: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { card_type: Card, query: "char" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that matches to dfc pair is processed correctly", () => {
  expect(
    processLine("2 Huntmaster of the Fells", dfcPairs, false)
  ).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { card_type: Card, query: "ravager of the fells" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that fuzzy matches to dfc pair is processed correctly", () => {
  expect(processLine("2 bat", { batman: "ratman" }, true)).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "bat" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { card_type: Card, query: "ratman" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that doesn't fuzzy match to dfc pair is processed correctly", () => {
  expect(processLine("2 cat", { batman: "ratman" }, true)).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "cat" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that fuzzy matches ambiguously to dfc pair is processed correctly", () => {
  expect(
    processLine("2 bat", { batman: "ratman", batwoman: "ratwoman" }, true)
  ).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "bat" },
      selectedImage: undefined,
      selected: false,
    },
    null, // ambiguous -> no match
  ]);
});

test("line that matches to dfc pair but a back is also manually specified is processed correctly", () => {
  expect(
    processLine("2 Huntmaster of the Fells | t:Goblin", dfcPairs, false)
  ).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { card_type: Token, query: "goblin" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("a card name that's a subset of a DFC pair's front is not matched", () => {
  expect(
    processStringAsMultipleLines(
      "1 elesh norn\n1 elesh norn, grand cenobite",
      {
        "elesh norn": "the argent etchings",
      },
      false
    )
  ).toStrictEqual([
    [
      1,
      {
        query: { card_type: Card, query: "elesh norn" },
        selectedImage: undefined,
        selected: false,
      },
      {
        query: { card_type: Card, query: "the argent etchings" },
        selectedImage: undefined,
        selected: false,
      },
    ],
    [
      1,
      {
        query: { card_type: Card, query: "elesh norn grand cenobite" },
        selectedImage: undefined,
        selected: false,
      },
      null,
    ],
  ]);
});

test("line that requests 0 of a card is processed correctly", () => {
  expect(processLine("0 opt", dfcPairs, false)).toStrictEqual([
    0,
    {
      query: { card_type: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that requests -1 of a card is processed correctly", () => {
  expect(processLine("-1 opt", dfcPairs, false)).toStrictEqual([
    1,
    {
      query: { card_type: Card, query: "-1 opt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("multiple lines processed correctly", () => {
  expect(
    processStringAsMultipleLines(
      "char\n0 lightning bolt\n2x delver of secrets",
      dfcPairs,
      false
    )
  ).toStrictEqual([
    [
      1,
      {
        query: { card_type: Card, query: "char" },
        selectedImage: undefined,
        selected: false,
      },
      null,
    ],
    [
      2,
      {
        query: { card_type: Card, query: "delver of secrets" },
        selectedImage: undefined,
        selected: false,
      },
      {
        query: { card_type: Card, query: "insectile aberration" },
        selectedImage: undefined,
        selected: false,
      },
    ],
  ]);
});

test("a line specifying the selected image ID for the front is processed correctly", () => {
  expect(processLine("opt@xyz", dfcPairs, false)).toStrictEqual([
    1,
    {
      query: { card_type: Card, query: "opt" },
      selectedImage: "xyz",
      selected: false,
    },
    null,
  ]);
});

test("a line specifying the selected image ID for both faces is processed correctly", () => {
  expect(processLine("2 opt@xyz | char@abcd", dfcPairs, false)).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "opt" },
      selectedImage: "xyz",
      selected: false,
    },
    {
      query: { card_type: Card, query: "char" },
      selectedImage: "abcd",
      selected: false,
    },
  ]);
});

describe("URLs are sanitised correctly", () => {
  each([
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8000/",
    "https://127.0.0.1:8000",
    "127.0.0.1:8000",
    "127.0.0.1:8000/",
    "127.0.0.1:8000/path",
  ]).test("%s", (text) => {
    expect(standardiseURL(text)).toBe(
      "http" + (text.includes("http://") ? "" : "s") + "://127.0.0.1:8000"
    );
  });
});

// # endregion
