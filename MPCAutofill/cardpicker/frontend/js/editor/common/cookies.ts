/**
 * Data API for interacting with anything stored in cookies.
 * TODO: move the functionality for checking if users consent to Google Analytics tracking to here.
 */

import Cookies from "js-cookie";
import Ajv from "ajv";
import { SearchSettings, SourceDocuments, SourceRow } from "./types";
import { searchSettingsSchema } from "./schemas";

const ajv = new Ajv();

export function getCookieSearchSettings(
  sourceDocuments: SourceDocuments
): SearchSettings | null {
  // TODO: this feels pretty unsafe
  const rawSettings = JSON.parse(Cookies.get("searchSettings") ?? "{}");
  const validate = ajv.compile(searchSettingsSchema);
  const rawSettingsValid = validate(rawSettings);
  if (rawSettingsValid) {
    const validatedSettings: SearchSettings = rawSettings as SearchSettings; // TODO
    // reconcile against sourceDocuments
    const sourceInDatabaseSet: Set<number> = new Set(
      Object.values(sourceDocuments).map((sourceDocument) => sourceDocument.pk)
    );
    const sources: Array<SourceRow> =
      validatedSettings.sourceSettings.sources ?? [];
    const sourceInCookieSet: Set<number> = new Set(
      sources.map((row) => row[0])
    );
    // one fat line of reconciliation, good luck reading this future nick! i wrote this at 12:26am.
    const updatedSources = sources
      .filter((row: SourceRow) => sourceInDatabaseSet.has(row[0]))
      .concat(
        Array.from(sourceInDatabaseSet)
          .filter((pk: number) => !sourceInCookieSet.has(pk))
          .map((pk: number) => [pk, true])
      );
    return {
      ...validatedSettings,
      sourceSettings: {
        ...validatedSettings.sourceSettings,
        sources: updatedSources,
      },
    };
  } else {
    return null;
  }
}

export function setCookieSearchSettings(settings: SearchSettings): void {
  Cookies.set("searchSettings", JSON.stringify(settings));
}
