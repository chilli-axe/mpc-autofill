import { CardTypePrefixes, FaceSeparator, Card } from "./constants";
import { DFCPairs, SearchQuery, ProcessedLine } from "./types";

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

export function imageSizeToMBString(
  size: number,
  numDecimalPlaces: number
): string {
  /**
   * Format `size` (a size in bytes) as a string in megabytes.
   */

  const roundFactor = 10 ** numDecimalPlaces;
  let sizeMB = size / 1000000;
  sizeMB = Math.round(sizeMB * roundFactor) / roundFactor;
  return `${sizeMB} MB`;
}

export function bracket(projectSize: number): number {
  /**
   * Calculate the MPC bracket that `projectSize` falls into.
   */

  const brackets = [
    18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612,
  ];
  for (let i = 0; i < brackets.length; i++) {
    if (brackets[i] >= projectSize) {
      return brackets[i];
    }
  }
  return brackets[brackets.length - 1];
}

export function downloadImage(imageURL: string, new_tab = true) {
  /**
   * Download an image with the given download link.
   * Note that this only works when `imageURL` has the same origin as where the link was opened from.
   */

  const element = document.createElement("a");
  element.href = imageURL;
  element.setAttribute("download", "deez.png"); // TODO: can we affect file name?
  if (new_tab) element.target = "_blank";

  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

export function downloadText(filename: string, text: string) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

export function processQuery(query: string): string {
  /**
   * Process `query` by converting to lowercase, removing all punctuation, and sanitising whitespace.
   * Note that hyphens are not removed due to how Elasticsearch's classic tokenizer works:
   * https://www.elastic.co/guide/en/elasticsearch/reference/7.17/analysis-classic-tokenizer.html
   */

  // escaping \[ is technically unnecessary, but I think it's more readable to escape it
  return (
    query
      .toLowerCase()
      .trim()
      // eslint-disable-next-line
      .replace(/[~`!@#$%^&*(){}\[\];:"'<,.>?/\\|_+=]/g, "")
      .replace(/ +(?= )/g, "")
  );
}

export function processPrefix(query: string): SearchQuery {
  /**
   * Identify the prefix of a query. For example, `query`="t:goblin" would yield ["goblin", TOKEN].
   */

  for (const [prefix, cardType] of Object.entries(CardTypePrefixes)) {
    if (
      prefix !== "" &&
      query.trimStart().toLowerCase().startsWith(`${prefix}:`)
    ) {
      return {
        query: processQuery(query.trimStart().slice(prefix.length + 1)),
        card_type: cardType,
      };
    }
  }
  return { query: processQuery(query), card_type: CardTypePrefixes[""] };
}

export function processLine(line: string, dfcPairs: DFCPairs): ProcessedLine {
  /**
   * Process `line` to identify the search query and the number of instances requested for each face.
   * If no back query is specified, attempt to match the front query to a DFC pair.
   * For example, `line`="3x t:goblin" would yield [["goblin", TOKEN, 3], null].
   * Another example is `line`="3x forest | b:elf" would yield [3, ["forest", CARD], ["elf", TOKEN]].
   */

  const trimmedLine = line.replace(/\s+/g, " ").trim();
  if (trimmedLine.length === 0) {
    return [0, null, null];
  }
  const re = /^([0-9]*)?x?\s?(.*)$/; // note that "x" after the quantity is ignored - e.g. 3x and 3 are treated the same
  const results = re.exec(trimmedLine);
  const quantity = parseInt(results[1] ?? "1");

  let frontQuery: SearchQuery | null = null;
  let backQuery: SearchQuery | null = null;
  const [frontRawQuery, backRawQuery] = results[2].split(FaceSeparator);
  if (frontRawQuery != null && frontRawQuery.length > 0) {
    frontQuery = processPrefix(frontRawQuery);
  }
  if (backRawQuery != null && backRawQuery.length > 0) {
    backQuery = processPrefix(backRawQuery);
  } else if (frontQuery != null && frontQuery.query in dfcPairs) {
    // attempt to match to DFC pair
    // TODO: is it problematic to assume that all DFC pairs are the `Card` type?
    backQuery = { query: dfcPairs[frontQuery.query], card_type: Card };
  }
  return [quantity, frontQuery, backQuery];
}

export function processLines(
  lines: string,
  dfcPairs: DFCPairs
): Array<ProcessedLine> {
  /**
   * Process each line in `lines`.
   */

  const queries: Array<[number, SearchQuery?, SearchQuery?]> = [];
  lines.split(/\r?\n|\r|\n/g).forEach((line: string) => {
    if (line != null && line.trim().length > 0) {
      const [quantity, frontSearchQuery, backSearchQuery] = processLine(
        line,
        dfcPairs
      );
      if (frontSearchQuery != null || backSearchQuery != null) {
        queries.push([quantity, frontSearchQuery, backSearchQuery]);
      }
    }
  });
  return queries;
}
