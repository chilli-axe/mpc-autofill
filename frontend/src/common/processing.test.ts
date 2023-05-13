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
  expect(processLine("opt", dfcPairs)).toStrictEqual([
    1,
    { query: { card_type: Card, query: "opt" }, selectedImage: undefined },
    null,
  ]);
});

test("non-dfc line is processed correctly", () => {
  expect(processLine("3x Lightning Bolt", dfcPairs)).toStrictEqual([
    3,
    {
      query: { card_type: Card, query: "lightning bolt" },
      selectedImage: undefined,
    },
    null,
  ]);
});

test("non-dfc cardback line is processed correctly", () => {
  expect(processLine("3x b:Black Lotus", dfcPairs)).toStrictEqual([
    3,
    {
      query: { card_type: Cardback, query: "black lotus" },
      selectedImage: undefined,
    },
    null,
  ]);
});

test("manually specified front and back line is processed correctly", () => {
  expect(processLine("5 Opt | Char", dfcPairs)).toStrictEqual([
    5,
    { query: { card_type: Card, query: "opt" }, selectedImage: undefined },
    { query: { card_type: Card, query: "char" }, selectedImage: undefined },
  ]);
});

test("line that matches to dfc pair is processed correctly", () => {
  expect(processLine("2 Huntmaster of the Fells", dfcPairs)).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
    },
    {
      query: { card_type: Card, query: "ravager of the fells" },
      selectedImage: undefined,
    },
  ]);
});

test("line that matches to dfc pair but a back is also manually specified is processed correctly", () => {
  expect(
    processLine("2 Huntmaster of the Fells | t:Goblin", dfcPairs)
  ).toStrictEqual([
    2,
    {
      query: { card_type: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
    },
    { query: { card_type: Token, query: "goblin" }, selectedImage: undefined },
  ]);
});

test("a card name that's a subset of a DFC pair's front is not matched", () => {
  expect(
    processStringAsMultipleLines("1 elesh norn\n1 elesh norn, grand cenobite", {
      "elesh norn": "the argent etchings",
    })
  ).toStrictEqual([
    [
      1,
      {
        query: { card_type: Card, query: "elesh norn" },
        selectedImage: undefined,
      },
      {
        query: { card_type: Card, query: "the argent etchings" },
        selectedImage: undefined,
      },
    ],
    [
      1,
      {
        query: { card_type: Card, query: "elesh norn grand cenobite" },
        selectedImage: undefined,
      },
      null,
    ],
  ]);
});

test("line that requests 0 of a card is processed correctly", () => {
  expect(processLine("0 opt", dfcPairs)).toStrictEqual([
    0,
    { query: { card_type: Card, query: "opt" }, selectedImage: undefined },
    null,
  ]);
});

test("line that requests -1 of a card is processed correctly", () => {
  expect(processLine("-1 opt", dfcPairs)).toStrictEqual([
    1,
    { query: { card_type: Card, query: "-1 opt" }, selectedImage: undefined },
    null,
  ]);
});

test("multiple lines processed correctly", () => {
  expect(
    processStringAsMultipleLines(
      "char\n0 lightning bolt\n2x delver of secrets",
      dfcPairs
    )
  ).toStrictEqual([
    [
      1,
      { query: { card_type: Card, query: "char" }, selectedImage: undefined },
      null,
    ],
    [
      2,
      {
        query: { card_type: Card, query: "delver of secrets" },
        selectedImage: undefined,
      },
      {
        query: { card_type: Card, query: "insectile aberration" },
        selectedImage: undefined,
      },
    ],
  ]);
});

test("a line specifying the selected image ID for the front is processed correctly", () => {
  expect(processLine("opt@xyz", dfcPairs)).toStrictEqual([
    1,
    { query: { card_type: Card, query: "opt" }, selectedImage: "xyz" },
    null,
  ]);
});

test("a line specifying the selected image ID for both faces is processed correctly", () => {
  expect(processLine("2 opt@xyz | char@abcd", dfcPairs)).toStrictEqual([
    2,
    { query: { card_type: Card, query: "opt" }, selectedImage: "xyz" },
    { query: { card_type: Card, query: "char" }, selectedImage: "abcd" },
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
