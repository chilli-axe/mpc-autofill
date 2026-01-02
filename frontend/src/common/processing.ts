/**
 * This module contains functions which sanitise and transform user inputs for cards to query into useful formats.
 */

import { toByteArray } from "base64-js";
// @ts-ignore
import { parse } from "lil-csv";

import {
  Card,
  Cardback,
  CardTypePrefixes,
  CardTypeSeparator,
  CSVHeaders,
  FaceSeparator,
  FaceSeparatorRegexEscaped,
  ProjectMaxSize,
  ReversedCardTypePrefixes,
  SelectedImageSeparator,
  Token,
} from "@/common/constants";
import {
  CardDocument,
  CSVRow,
  DFCPairs,
  ProcessedLine,
  ProjectMember,
  SearchQuery,
  SlotProjectMembers,
} from "@/common/types";

/**
 * Clean any instances of doubled-up whitespace from `text`.
 */
export function sanitiseWhitespace(text: string): string {
  const re = / +(?= )/g;
  return text.replaceAll(re, "").trim();
}

/**
 * Remove all text within (parentheses) from `text`.
 * Does not handle (nested (parentheses)). TODO: update this function to do this
 */
export function stripTextInParentheses(text: string): string {
  const re = /[([].*?[)\]]/g;
  return sanitiseWhitespace(text.replaceAll(re, ""));
}

/**
 * Process `query` by converting to lowercase, removing all punctuation, and sanitising whitespace.
 * Note that hyphens are not removed due to how Elasticsearch's classic tokenizer works:
 * https://www.elastic.co/guide/en/elasticsearch/reference/7.17/analysis-classic-tokenizer.html
 */
export function processQuery(query: string): string {
  // TODO: remove any numbers from the front
  // escaping \[ is technically unnecessary, but I think it's more readable to escape it
  return sanitiseWhitespace(
    query
      .toLowerCase()
      .trim()
      .replace(/[~`!@#$%^&*(){}\[\];:"'’<,.>?/\\|_+=]/g, "")
  );
}

/**
 * Identify the prefix of a query. For example, `query`="t:goblin" would yield
 *   {query: "goblin", cardType: TOKEN}.
 */
export function processPrefix(query: string): SearchQuery {
  for (const [prefix, cardType] of Object.entries(CardTypePrefixes)) {
    if (
      prefix !== "" &&
      query
        .trimStart()
        .toLowerCase()
        .startsWith(`${prefix}${CardTypeSeparator}`)
    ) {
      return {
        query: processQuery(query.trimStart().slice(prefix.length + 1)),
        cardType: cardType,
      };
    }
  }
  return { query: processQuery(query), cardType: CardTypePrefixes[""] };
}

const getPhrasesNotAllowedInIdentifiers = (): Array<string> => [
  SelectedImageSeparator,
  FaceSeparatorRegexEscaped,
];

const getPhrasesNotAllowedInIdentifiersNegativeLookahead = (): string =>
  `(?!.*?(?:${getPhrasesNotAllowedInIdentifiers().join("|")})).*`;

const trimLine = (line: string): string => line.replace(/\s+/g, " ").trim();

/**
 * Extract the quantity component of `line`, which follows one of these forms:
 * * `<quantity - numeric> <query>`
 * * `<quantity - numeric>x <query>`
 * * `<query>` (quantity is assumed to be 1 in this case)
 * @param line
 * @returns Tuple of the form [quantity, remainder of the string]
 */
const extractQuantity = (line: string): [number, string] => {
  const re = /^([0-9]+[xX]?\s+)?(.*)$/g;
  const results = re.exec(trimLine(line));
  if (results == null) {
    return [0, ""];
  }
  const quantity = parseInt(
    (results[1] ?? "1").toLowerCase().replace("x", "").trim()
  );
  return [quantity, results[2]];
};

/**
 * Unpack `line` into its constituents.
 *
 * Inputs to this function are unpacked according to the below schema. For example, consider `4x opt@1234 | char@xyz`:
 *       4x               opt        @        1234         |      char       @        xyz
 * └─ quantity ──┘ └─ front query ──┘ └─ front image ID ──┘ └─ back query ──┘ └─ back image ID ──┘
 *
 * If quantity is not specified, we assume a quantity of 1.
 * Specifying a back query is optional.
 * Specifying an image ID (for each face) is optional.
 */
function unpackLine(
  line: string
): [number, [string, string | null] | null, [string, string | null] | null] {
  const [quantity, trimmedLine] = extractQuantity(line);

  const [frontLine, backLine] = trimmedLine.split(` ${FaceSeparator} `);

  const faceLineRegex = new RegExp(
    `^(.+?)(?:${SelectedImageSeparator}(${getPhrasesNotAllowedInIdentifiersNegativeLookahead()}))?$`,
    "gm"
  );
  const frontLineResults = [...frontLine.matchAll(faceLineRegex)][0];
  const backLineResults =
    backLine !== undefined ? [...backLine.matchAll(faceLineRegex)][0] : null;

  if (frontLineResults === null) {
    return [0, null, null];
  }
  return [
    quantity,
    [frontLineResults[1], frontLineResults[2]],
    backLineResults !== null ? [backLineResults[1], backLineResults[2]] : null,
  ];
}

/**
 * Process `line` to identify the search query and the number of instances requested for each face.
 * If no back query is specified, attempt to match the front query to a DFC pair.
 * For example, `line`="3x t:goblin" would yield:
 *   [3, {query: {query: "goblin", cardType: TOKEN, selectedImage: null}}, null].
 * Another example is `line`="3x forest | b:elf" would yield:
 *   [
 *     3,
 *     {query: {query: "forest", cardType: CARD}, selectedImage: null},
 *     {query: {query: "elf", cardType: TOKEN}, selectedImage: null},
 *   ].
 */
export function processLine(
  line: string,
  dfcPairs: DFCPairs,
  fuzzySearch: boolean
): ProcessedLine {
  const [quantity, frontRawQuery, backRawQuery] = unpackLine(line);

  let frontQuery: SearchQuery | null = null;
  let frontSelectedImage: string | undefined = undefined;
  if (frontRawQuery != null && (frontRawQuery[0] ?? "").length > 0) {
    frontQuery = processPrefix(frontRawQuery[0]);
    frontSelectedImage = frontRawQuery[1] ?? undefined;
  }

  let backQuery: SearchQuery | null = null;
  let backSelectedImage: string | undefined = undefined;
  if (backRawQuery != null && (backRawQuery[0] ?? "").length > 0) {
    backQuery = processPrefix(backRawQuery[0]);
    backSelectedImage = backRawQuery[1] ?? undefined;
  } else if (frontQuery != null && frontQuery?.query != null) {
    // typescript isn't smart enough to know that frontQuery.query is not null, so we have to do this
    const frontQueryQuery = frontQuery.query;
    let dfcPairMatchFront: string | null = null;
    if (fuzzySearch) {
      const matches = Object.keys(dfcPairs).filter((dfcPairFront) =>
        dfcPairFront.startsWith(frontQueryQuery)
      );
      if (matches.length === 1) {
        dfcPairMatchFront = matches[0];
      }
    } else if (frontQueryQuery in dfcPairs) {
      dfcPairMatchFront = frontQueryQuery;
    }
    if (dfcPairMatchFront != null) {
      // match to the card's DFC pair. assume the back is the same card type as the front.
      backQuery = {
        query: dfcPairs[dfcPairMatchFront],
        cardType: frontQuery.cardType,
      };
    }
  }

  return [
    quantity,
    frontQuery != null
      ? {
          query: frontQuery,
          selectedImage: frontSelectedImage,
          selected: false,
        }
      : null,
    backQuery != null
      ? { query: backQuery, selectedImage: backSelectedImage, selected: false }
      : null,
  ];
}

/**
 * Process each line in `lines`, ignoring any lines which don't contain relevant information.
 */
export function processLines(
  lines: Array<string>,
  dfcPairs: DFCPairs,
  fuzzySearch: boolean
): Array<ProcessedLine> {
  const queries: Array<[number, ProjectMember | null, ProjectMember | null]> =
    [];
  lines.forEach((line: string) => {
    if (line != null && line.trim().length > 0) {
      const [quantity, frontMember, backMember] = processLine(
        line,
        dfcPairs,
        fuzzySearch
      );
      if (quantity > 0 && (frontMember != null || backMember != null)) {
        queries.push([quantity, frontMember, backMember]);
      }
    }
  });
  return queries;
}

export function processStringAsMultipleLines(
  lines: string,
  dfcPairs: DFCPairs,
  fuzzySearch: boolean
): Array<ProcessedLine> {
  return processLines(lines.split(/\r?\n|\r|\n/g), dfcPairs, fuzzySearch);
}

/**
 * This function converts `lines` into a format ready to be added to the Redux store.
 * The project max size is respected here in addition to in the `addMembers` action
 * to avoid doing unnecessary processing work if a large list of `ProcessedLine` items
 * is given.
 */
export function convertLinesIntoSlotProjectMembers(
  lines: Array<ProcessedLine>,
  memberCount: number
): Array<SlotProjectMembers> {
  let newMembers: Array<SlotProjectMembers> = [];
  for (const [quantity, frontMember, backMember] of lines) {
    const cappedQuantity = Math.min(
      quantity,
      ProjectMaxSize - (memberCount + newMembers.length)
    );
    if (frontMember != null || backMember != null) {
      newMembers = [
        ...newMembers,
        ...Array(cappedQuantity).fill({
          front: {
            query: frontMember?.query,
            selectedImage: frontMember?.selectedImage,
            selected: false,
          },
          back: {
            query: backMember?.query ?? { query: null, cardType: Cardback },
            selectedImage: backMember?.selectedImage,
            selected: false,
          },
        }),
      ];
      if (memberCount + newMembers.length >= ProjectMaxSize) {
        break;
      }
    }
  }
  return newMembers;
}

/**
 * Standardise `url` in the following ways:
 * 1. Ensure a http prefix is included, defaulting to `https://` if not specified
 * 2. Trim any trailing slash and path
 */
export function standardiseURL(url: string): string {
  const re = [...url.matchAll(/^(https?:\/\/)?(.*?)(?:\/.*)?$/gm)][0];
  return (re[1] ?? "https://") + re[2];
}

export function formatURL(backendURL: string, routeURL: string): string {
  return new URL(routeURL, backendURL).toString();
}

export function base64StringToBlob(base64: string): Blob {
  // @ts-ignore // TODO: broke in TS 4 to 5 migration
  return new Blob([toByteArray(base64)]);
}

export const formatPlaceholderText = (placeholders: {
  [cardType: string]: Array<CardDocument>;
}): string => {
  const separator = "\n";
  const placeholderTextByCardType: Array<string> = [];

  for (const cardType of [Card, Token, Cardback]) {
    if (placeholders[cardType] != null) {
      placeholderTextByCardType.push(
        placeholders[cardType]
          .map(
            (x) =>
              `${Math.floor(Math.random() * 3) + 1}x ${
                ReversedCardTypePrefixes[cardType]
              }${stripTextInParentheses(x.name)}`
          )
          .join(separator)
      );
    }
  }
  return placeholderTextByCardType.join(separator + separator);
};

export const parseCSVRowAsLine = (rawRow: CSVRow): string => {
  const row = Object.fromEntries(
    Object.entries(rawRow).map(([key, value]) => [key.trim(), value?.trim()])
  );
  let formattedLine = `${row[CSVHeaders.quantity] ?? ""} ${
    row[CSVHeaders.frontQuery] ?? ""
  }`;
  if ((row[CSVHeaders.frontSelectedImage] ?? "").length > 0) {
    formattedLine += `${SelectedImageSeparator}${
      row[CSVHeaders.frontSelectedImage]
    }`;
  }
  if ((row[CSVHeaders.backQuery] ?? "").length > 0) {
    formattedLine += ` ${FaceSeparator} ${row[CSVHeaders.backQuery]}`;
    if ((row[CSVHeaders.backSelectedImage] ?? "").length > 0) {
      formattedLine += `${SelectedImageSeparator}${
        row[CSVHeaders.backSelectedImage]
      }`;
    }
  }
  return formattedLine;
};

export const parseCSVFileAsLines = (fileContents: string): Array<string> => {
  const rows: Array<CSVRow> = parse(fileContents);
  return rows.map(parseCSVRowAsLine);
};

export const removeFileExtension = (fileName: string): string =>
  fileName.replace(/^(.+?)(?:\..+)?$/, "$1");

export const toSearchable = (inputString: string): string =>
  inputString
    .toLowerCase()
    .replaceAll(/[\(\[].*?[\)\]]/g, "")
    .replace("-", " ")
    .replace(" the ", " ")
    .replace("’", "'")
    .replaceAll(/!\"#$%&'()*\+,-.\/:;<=>?@\[\]^_`{|}~\//g, "") // remove punctuation
    .replaceAll(/0123456789/g, "") // remove digits
    .replaceAll(/^the (.*$)/g, "$1") // remove "the " at start of string
    .split(" ")
    .map((word) => word.trim())
    .join(" ")
    .trim();
