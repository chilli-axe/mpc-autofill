import {
  Card,
  Cardback,
  FaceSeparator,
  SelectedImageSeparator,
  Token,
} from "@/common/constants";
import {
  parseCSVFileAsLines,
  processLine,
  processQuery,
  processSearchQuery,
  processStringAsMultipleLines,
  sanitiseWhitespace,
  standardiseURL,
  stripTextInParentheses,
  toSearchable,
} from "@/common/processing";
import { CardType } from "@/common/schema_types";
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

test.each([
  {
    input: "goblin",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Card,
      expansionCode: undefined,
      collectorNumber: undefined,
    },
  },
  {
    input: "t:goblin",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Token,
      expansionCode: undefined,
      collectorNumber: undefined,
    },
  },
  {
    input: "b:goblin",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Cardback,
      expansionCode: undefined,
      collectorNumber: undefined,
    },
  },
  {
    input: "goblin (AKH)",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Card,
      expansionCode: "AKH",
      collectorNumber: undefined,
    },
  },
  {
    input: "goblin (AKH) 123",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Card,
      expansionCode: "AKH",
      collectorNumber: "123",
    },
  },
  {
    input: "t:goblin (AKH) abcdef",
    expectedOutput: {
      query: "goblin",
      cardType: CardType.Token,
      expansionCode: "AKH",
      collectorNumber: "abcdef",
    },
  },
])("processSearchQuery", ({ input, expectedOutput }) => {
  expect(processSearchQuery(input)).toEqual(expectedOutput);
});

test("line that doesn't specify quantity is processed correctly", () => {
  expect(processLine("opt", dfcPairs, false)).toEqual([
    1,
    {
      query: { cardType: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that doesn't specify quantity but name begins with X is processed correctly", () => {
  expect(processLine("xenagos the reveler", dfcPairs, false)).toEqual([
    1,
    {
      query: { cardType: Card, query: "xenagos the reveler" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("non-dfc line is processed correctly", () => {
  expect(processLine("3x Lightning Bolt", dfcPairs, false)).toEqual([
    3,
    {
      query: {
        cardType: Card,
        query: "lightning bolt",
        expansionCode: undefined,
        collectorNumber: undefined,
      },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("non-dfc cardback line is processed correctly", () => {
  expect(processLine("3x b:Black Lotus", dfcPairs, false)).toEqual([
    3,
    {
      query: {
        cardType: Cardback,
        query: "black lotus",
        expansionCode: undefined,
        collectorNumber: undefined,
      },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("manually specified front and back line is processed correctly", () => {
  expect(processLine(`5 Opt${FaceSeparator}Char`, dfcPairs, false)).toEqual([
    5,
    {
      query: { cardType: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { cardType: Card, query: "char" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that matches to dfc pair is processed correctly", () => {
  expect(processLine("2 Huntmaster of the Fells", dfcPairs, false)).toEqual([
    2,
    {
      query: { cardType: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { cardType: Card, query: "ravager of the fells" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that fuzzy matches to dfc pair is processed correctly", () => {
  expect(processLine("2 bat", { batman: "ratman" }, true)).toEqual([
    2,
    {
      query: { cardType: Card, query: "bat" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { cardType: Card, query: "ratman" },
      selectedImage: undefined,
      selected: false,
    },
  ]);
});

test("line that doesn't fuzzy match to dfc pair is processed correctly", () => {
  expect(processLine("2 cat", { batman: "ratman" }, true)).toEqual([
    2,
    {
      query: { cardType: Card, query: "cat" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that fuzzy matches ambiguously to dfc pair is processed correctly", () => {
  expect(
    processLine("2 bat", { batman: "ratman", batwoman: "ratwoman" }, true)
  ).toEqual([
    2,
    {
      query: { cardType: Card, query: "bat" },
      selectedImage: undefined,
      selected: false,
    },
    null, // ambiguous -> no match
  ]);
});

test("line that matches to dfc pair but a back is also manually specified is processed correctly", () => {
  expect(
    processLine(
      `2 Huntmaster of the Fells${FaceSeparator}t:Goblin`,
      dfcPairs,
      false
    )
  ).toEqual([
    2,
    {
      query: { cardType: Card, query: "huntmaster of the fells" },
      selectedImage: undefined,
      selected: false,
    },
    {
      query: { cardType: Token, query: "goblin" },
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
  ).toEqual([
    [
      1,
      {
        query: {
          cardType: Card,
          query: "elesh norn",
          expansionCode: undefined,
          collectorNumber: undefined,
        },
        selectedImage: undefined,
        selected: false,
      },
      {
        query: {
          cardType: Card,
          query: "the argent etchings",
          expansionCode: undefined,
          collectorNumber: undefined,
        },
        selectedImage: undefined,
        selected: false,
      },
    ],
    [
      1,
      {
        query: {
          cardType: Card,
          query: "elesh norn grand cenobite",
          expansionCode: undefined,
          collectorNumber: undefined,
        },
        selectedImage: undefined,
        selected: false,
      },
      null,
    ],
  ]);
});

test("line that requests 0 of a card is processed correctly", () => {
  expect(processLine("0 opt", dfcPairs, false)).toEqual([
    0,
    {
      query: { cardType: Card, query: "opt" },
      selectedImage: undefined,
      selected: false,
    },
    null,
  ]);
});

test("line that requests -1 of a card is processed correctly", () => {
  expect(processLine("-1 opt", dfcPairs, false)).toEqual([
    1,
    {
      query: { cardType: Card, query: "-1 opt" },
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
  ).toEqual([
    [
      1,
      {
        query: { cardType: Card, query: "char" },
        selectedImage: undefined,
        selected: false,
      },
      null,
    ],
    [
      2,
      {
        query: { cardType: Card, query: "delver of secrets" },
        selectedImage: undefined,
        selected: false,
      },
      {
        query: { cardType: Card, query: "insectile aberration" },
        selectedImage: undefined,
        selected: false,
      },
    ],
  ]);
});

test("a line specifying the selected image ID for the front is processed correctly", () => {
  expect(
    processLine(`opt${SelectedImageSeparator}xyz`, dfcPairs, false)
  ).toEqual([
    1,
    {
      query: { cardType: Card, query: "opt" },
      selectedImage: "xyz",
      selected: false,
    },
    null,
  ]);
});

test("a line specifying the selected image ID for both faces is processed correctly", () => {
  expect(
    processLine(
      `2 opt${SelectedImageSeparator}xyz${FaceSeparator}char${SelectedImageSeparator}abcd`,
      dfcPairs,
      false
    )
  ).toEqual([
    2,
    {
      query: { cardType: Card, query: "opt" },
      selectedImage: "xyz",
      selected: false,
    },
    {
      query: { cardType: Card, query: "char" },
      selectedImage: "abcd",
      selected: false,
    },
  ]);
});

describe("file path-like identifier handling", () => {
  test.each([
    {
      line: "opt@./some/path/opt.png",
      expectedResult: [
        1,
        {
          query: {
            query: "opt",
            cardType: CardType.Card,
          },
          selectedImage: "./some/path/opt.png",
          selected: false,
        },
        null,
      ],
    },
    {
      line: "opt@./some/path/opt.png // char",
      expectedResult: [
        1,
        {
          query: {
            query: "opt",
            cardType: CardType.Card,
          },
          selectedImage: "./some/path/opt.png",
          selected: false,
        },
        {
          query: {
            query: "char",
            cardType: CardType.Card,
          },
          selectedImage: undefined,
          selected: false,
        },
      ],
    },
    {
      line: "opt@./some/path/opt.png // char@./some/other/path/char.jpg",
      expectedResult: [
        1,
        {
          query: {
            query: "opt",
            cardType: CardType.Card,
          },
          selectedImage: "./some/path/opt.png",
          selected: false,
        },
        {
          query: {
            query: "char",
            cardType: CardType.Card,
          },
          selectedImage: "./some/other/path/char.jpg",
          selected: false,
        },
      ],
    },
    {
      line: "opt@./some path with spaces/opt.png",
      expectedResult: [
        1,
        {
          query: {
            query: "opt",
            cardType: CardType.Card,
          },
          selectedImage: "./some path with spaces/opt.png",
          selected: false,
        },
        null,
      ],
    },
  ])("%s", ({ line, expectedResult }) => {
    expect(processLine(line, {}, false)).toEqual(expectedResult);
  });
});

describe("toSearchable", () => {
  test.each([
    { input: "Lightning Bolt", expectedOutput: "lightning bolt" },
    { input: " Lightning   BOLT ", expectedOutput: "lightning bolt" },
    { input: "Adanto, the First Fort", expectedOutput: "adanto first fort" },
    { input: "Black Lotus (Masterpiece)", expectedOutput: "black lotus" }, // brackets removal
    {
      input: "Black Lotus (Masterpiece, But With Punctuation! )",
      expectedOutput: "black lotus",
    },
    { input: "Juzám Djinn", expectedOutput: "juzam djinn" }, // orama will NOT handle this
    { input: " Expansion _ Explosion", expectedOutput: "expansion explosion" },
    { input: "Kodama’s Reach", expectedOutput: "kodamas reach" },
    { input: "消灭邪物", expectedOutput: "消灭邪物" },
  ])("%s", ({ input, expectedOutput }) => {
    expect(toSearchable(input)).toEqual(expectedOutput);
  });
});

describe("URLs are sanitised correctly", () => {
  test.each([
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8000/",
    "https://127.0.0.1:8000",
    "127.0.0.1:8000",
    "127.0.0.1:8000/",
    "127.0.0.1:8000/path",
  ])("%s", (text) => {
    expect(standardiseURL(text)).toBe(
      "http" + (text.includes("http://") ? "" : "s") + "://127.0.0.1:8000"
    );
  });
});

test.each([
  "Quantity,Front,Front ID,Back,Back ID\n2, opt, xyz, char, abcd",
  "Quantity, Front, Front ID, Back, Back ID\n2, opt, xyz, char, abcd",
  "Quantity,   Front, Front ID,   Back,  Back ID   \n    2,   opt,  xyz,  char, abcd  ",
])("CSV is parsed correctly", () => {
  const csv =
    "Quantity, Front, Front ID, Back, Back ID\n2, opt, xyz, char, abcd";
  expect(parseCSVFileAsLines(csv)).toEqual([
    `2 opt${SelectedImageSeparator}xyz${FaceSeparator}char${SelectedImageSeparator}abcd`,
  ]);
});

// # endregion
