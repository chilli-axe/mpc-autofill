import {
  sanitiseWhitespace,
  stripTextInParentheses,
  processQuery,
  processPrefix,
  processLine,
  processLines,
} from "./processing";
import { Token, Card, Cardback } from "./constants";
import { DFCPairs } from "./types";

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
    { card_type: Card, query: "opt" },
    null,
  ]);
});

test("non-dfc line is processed correctly", () => {
  expect(processLine("3x Lightning Bolt", dfcPairs)).toStrictEqual([
    3,
    { card_type: Card, query: "lightning bolt" },
    null,
  ]);
});

test("non-dfc cardback line is processed correctly", () => {
  expect(processLine("3x b:Black Lotus", dfcPairs)).toStrictEqual([
    3,
    { card_type: Cardback, query: "black lotus" },
    null,
  ]);
});

test("manually specified front and back line is processed correctly", () => {
  expect(processLine("5 Opt | Char", dfcPairs)).toStrictEqual([
    5,
    { card_type: Card, query: "opt" },
    { card_type: Card, query: "char" },
  ]);
});

test("line that matches to dfc pair is processed correctly", () => {
  expect(processLine("2 Huntmaster of the Fells", dfcPairs)).toStrictEqual([
    2,
    { card_type: Card, query: "huntmaster of the fells" },
    { card_type: Card, query: "ravager of the fells" },
  ]);
});

test("line that matches to dfc pair but a back is also manually specified is processed correctly", () => {
  expect(
    processLine("2 Huntmaster of the Fells | t:Goblin", dfcPairs)
  ).toStrictEqual([
    2,
    { card_type: Card, query: "huntmaster of the fells" },
    { card_type: Token, query: "goblin" },
  ]);
});

test("line that requests 0 of a card is processed correctly", () => {
  expect(processLine("0 opt", dfcPairs)).toStrictEqual([
    0,
    { card_type: Card, query: "opt" },
    null,
  ]);
});

test("line that requests -1 of a card is processed correctly", () => {
  expect(processLine("-1 opt", dfcPairs)).toStrictEqual([
    1,
    { card_type: Card, query: "-1 opt" },
    null,
  ]);
});

test("multiple lines processed correctly", () => {
  expect(
    processLines("char\n0 lightning bolt\n2x delver of secrets", dfcPairs)
  ).toStrictEqual([
    [1, { card_type: Card, query: "char" }, null],
    [
      2,
      { card_type: Card, query: "delver of secrets" },
      { card_type: Card, query: "insectile aberration" },
    ],
  ]);
});

// # endregion
