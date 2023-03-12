/**
 * Data API for interacting with anything stored in cookies.
 * TODO: move the functionality for checking if users consent to Google Analytics tracking to here.
 */

import Cookies from "js-cookie";
import Ajv from "ajv";
import { SearchSettings, SourceDocuments, SourceRow } from "./types";
import { searchSettingsSchema } from "./schemas";
import { CSRFToken } from "./constants";

const ajv = new Ajv();

export function getCSRFHeader(): HeadersInit | undefined {
  const csrfToken = Cookies.get(CSRFToken);
  if (csrfToken != null) {
    return {
      "X-CSRFToken": Cookies.get(CSRFToken) ?? "",
    };
  }
  return undefined;
}

export function getCookieSearchSettings(
  sourceDocuments: SourceDocuments
): SearchSettings | null {
  /**
   * Get search settings from cookie data. If valid data is retrieved,
   * ensure that all `sourceDocuments` are included in the returned settings,
   * with any new sources that weren't previously included added to the end and enabled.
   */

  const rawSettings = JSON.parse(Cookies.get("searchSettings") ?? "{}");
  const validate = ajv.compile(searchSettingsSchema);
  const rawSettingsValid = validate(rawSettings);
  if (rawSettingsValid) {
    // reconcile against sourceDocuments
    const sourceInDatabaseSet: Set<number> = new Set(
      Object.values(sourceDocuments).map((sourceDocument) => sourceDocument.pk)
    );
    const sources: Array<SourceRow> = rawSettings.sourceSettings.sources ?? [];
    const sourceInCookieSet: Set<number> = new Set(
      sources.map((row) => row[0])
    );
    // one fat line of reconciliation, good luck reading this future nick! i wrote this at 12:26am.
    rawSettings.sourceSettings.sources = sources
      .filter((row: SourceRow) => sourceInDatabaseSet.has(row[0]))
      .concat(
        Array.from(sourceInDatabaseSet)
          .filter((pk: number) => !sourceInCookieSet.has(pk))
          .map((pk: number) => [pk, true])
      );
    return rawSettings;
  } else {
    return null;
  }
}

export function setCookieSearchSettings(settings: SearchSettings): void {
  Cookies.set("searchSettings", JSON.stringify(settings));
}
