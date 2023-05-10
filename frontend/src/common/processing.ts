/**
 * This module contains functions which sanitise and transform user inputs for cards to query into useful formats.
 */

import {
  Card,
  CardTypePrefixes,
  CardTypeSeparator,
  FaceSeparator,
  SelectedImageSeparator,
} from "@/common/constants";
import {
  DFCPairs,
  ProcessedLine,
  ProjectMember,
  SearchQuery,
} from "@/common/types";

export function sanitiseWhitespace(text: string): string {
  /**
   * Clean any instances of doubled-up whitespace from `text`.
   */

  const re = / +(?= )/g;
  return text.replaceAll(re, "").trim();
}

export function stripTextInParentheses(text: string): string {
  /**
   * Remove all text within (parentheses) from `text`.
   * Does not handle (nested (parentheses)). TODO: update this function to do this
   */

  const re = /[([].*?[)\]]/g;
  return sanitiseWhitespace(text.replaceAll(re, ""));
}

export function processQuery(query: string): string {
  /**
   * Process `query` by converting to lowercase, removing all punctuation, and sanitising whitespace.
   * Note that hyphens are not removed due to how Elasticsearch's classic tokenizer works:
   * https://www.elastic.co/guide/en/elasticsearch/reference/7.17/analysis-classic-tokenizer.html
   */

  // TODO: remove any numbers from the front
  // escaping \[ is technically unnecessary, but I think it's more readable to escape it
  return sanitiseWhitespace(
    query
      .toLowerCase()
      .trim()
      // eslint-disable-next-line
      .replace(/[~`!@#$%^&*(){}\[\];:"'<,.>?/\\|_+=]/g, "")
  );
}

export function processPrefix(query: string): SearchQuery {
  /**
   * Identify the prefix of a query. For example, `query`="t:goblin" would yield
   *   {query: "goblin", card_type: TOKEN}.
   */

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
        card_type: cardType,
      };
    }
  }
  return { query: processQuery(query), card_type: CardTypePrefixes[""] };
}

function unpackLine(
  line: string
): [number, [string, string | null] | null, [string, string | null] | null] {
  /**
   * Unpack `line` into its constituents.
   *
   * Inputs to this function are unpacked according to the below schema. For example, consider `4x opt@1234 | char@xyz`:
   *      4x                opt        @        1234         |      char       @        xyz
   * └─ quantity ──┘ └─ front query ──┘ └─ front image ID ──┘ └─ back query ──┘ └─ back image ID ──┘
   *
   * If quantity is not specified, we assume a quantity of 1.
   * Specifying a back query is optional.
   * Specifying an image ID (for each face) is optional.
   *
   * (sorry for jamming this much stuff into one regex 🗿)
   */

  const trimmedLine = line.replace(/\s+/g, " ").trim();
  const re = new RegExp(
    `^(?:([0-9]*)?[xX]?\\s?(.*?)(?:${SelectedImageSeparator}([A-z0-9_\\-]*))?)?(?:(?:\\s*)${
      "\\" + FaceSeparator
    }(?:\\s*)(.+?)(?:${SelectedImageSeparator}([A-z0-9_\\-]*))?)?$`,
    "gm"
  );
  const results = re.exec(trimmedLine);
  if (results == null) {
    return [0, null, null];
  }
  return [
    parseInt(results[1] ?? "1"),
    [results[2], results[3]],
    [results[4], results[5]],
  ];
}

export function processLine(line: string, dfcPairs: DFCPairs): ProcessedLine {
  /**
   * Process `line` to identify the search query and the number of instances requested for each face.
   * If no back query is specified, attempt to match the front query to a DFC pair.
   * For example, `line`="3x t:goblin" would yield:
   *   [3, {query: {query: "goblin", card_type: TOKEN, selectedImage: null}}, null].
   * Another example is `line`="3x forest | b:elf" would yield:
   *   [
   *     3,
   *     {query: {query: "forest", card_type: CARD}, selectedImage: null},
   *     {query: {query: "elf", card_type: TOKEN}, selectedImage: null},
   *   ].
   */

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
  } else if (
    frontQuery != null &&
    frontQuery?.query != null &&
    frontQuery.query in dfcPairs
  ) {
    // attempt to match to DFC pair
    // TODO: is it problematic to assume that all DFC pairs are the `Card` type?
    backQuery = { query: dfcPairs[frontQuery.query], card_type: Card };
  }

  return [
    quantity,
    frontQuery != null
      ? { query: frontQuery, selectedImage: frontSelectedImage }
      : null,
    backQuery != null
      ? { query: backQuery, selectedImage: backSelectedImage }
      : null,
  ];
}

export function processLines(
  lines: string,
  dfcPairs: DFCPairs
): Array<ProcessedLine> {
  /**
   * Process each line in `lines`, ignoring any lines which don't contain relevant information.
   */

  const queries: Array<[number, ProjectMember | null, ProjectMember | null]> =
    [];
  lines.split(/\r?\n|\r|\n/g).forEach((line: string) => {
    if (line != null && line.trim().length > 0) {
      const [quantity, frontMember, backMember] = processLine(line, dfcPairs);
      if (quantity > 0 && (frontMember != null || backMember != null)) {
        queries.push([quantity, frontMember, backMember]);
      }
    }
  });
  return queries;
}

export function standardiseURL(url: string): string {
  /**
   * Standardise `url` in the following ways:
   * 1. Ensure a http prefix is included, defaulting to `https://` if not specified
   * 2. Trim any trailing slash and path
   */

  const re = [...url.matchAll(/^(https?:\/\/)?(.*?)(?:\/.*)?$/gm)][0];
  return (re[1] ?? "https://") + re[2];
}

// TODO: delete this when remaining API interactions have been moved to RTK query
export function formatURL(backendURL: string, routeURL: string): string {
  // TODO: implement this properly
  return backendURL + routeURL;
}
