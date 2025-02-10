/**
 * Data API for interacting with anything stored in cookies or local storage.
 */

// import Ajv2020 from "ajv/dist/2020";
import Cookies from "js-cookie";

import {
  BackendURLKey,
  CSRFKey,
  GoogleAnalyticsConsentKey,
  SearchSettingsKey,
} from "@/common/constants";
import { Convert } from "@/common/schema_types";
import { SearchSettings, SourceDocuments, SourceRow } from "@/common/types";
import { getSourceRowsFromSourceSettings } from "@/common/utils";
import { getDefaultSearchSettings } from "@/store/slices/SearchSettingsSlice";

// import * as SearchSettingsSchema from "../../../schemas/schemas/SearchSettings.json";

// const ajv = new Ajv2020();

//# region CSRF
// TODO: unsure if we still need this.

export function getCSRFHeader(): HeadersInit | undefined {
  const csrfToken = Cookies.get(CSRFKey);
  if (csrfToken != null) {
    return { "X-CSRFToken": csrfToken };
  }
  return undefined;
}

//# endregion

//# region search settings

/**
 * Get search settings from localStorage data. If valid data is retrieved,
 * ensure that all `sourceDocuments` are included in the returned settings,
 * with any new sources that weren't previously included added to the end and enabled.
 */
export function getLocalStorageSearchSettings(
  sourceDocuments: SourceDocuments
): SearchSettings {
  const serialisedRawSettings = localStorage.getItem(SearchSettingsKey) ?? "{}";
  try {
    const searchSettings = Convert.toSearchSettings(serialisedRawSettings);
    // great, the user has valid search settings stored in their browser local storage.
    // reconcile against sourceDocuments
    const sourceInDatabaseSet: Set<number> = new Set(
      Object.values(sourceDocuments).map((sourceDocument) =>
        parseInt(sourceDocument.pk)
      )
    );
    // types have to be narrowed here because quicktype doesn't support our SourceRow data structure :(
    const sources: Array<SourceRow> = getSourceRowsFromSourceSettings(
      searchSettings.sourceSettings
    );
    const sourceInLocalStorageSet: Set<number> = new Set(
      sources.map((row) => row[0])
    );
    // one fat line of reconciliation, good luck reading this future nick! i wrote this at 12:26am.
    searchSettings.sourceSettings.sources = sources
      .filter((row: SourceRow) => sourceInDatabaseSet.has(row[0]))
      .concat(
        Array.from(sourceInDatabaseSet)
          .filter((pk: number) => !sourceInLocalStorageSet.has(pk))
          .map((pk: number) => [pk, true])
      );
    return searchSettings;
  } catch (e) {
    // quicktype will throw an error if the user's stored settings do not match the schema
    // e.g. upon first page load
    // just return the default settings
    return getDefaultSearchSettings(sourceDocuments);
  }
}

export function setLocalStorageSearchSettings(settings: SearchSettings): void {
  localStorage.setItem(SearchSettingsKey, JSON.stringify(settings));
}

//# endregion

//# region google analytics consent

export function getGoogleAnalyticsConsent(): boolean | undefined {
  const rawConsent = Cookies.get(GoogleAnalyticsConsentKey);
  return rawConsent != undefined ? JSON.parse(rawConsent) === true : undefined;
}

export function setGoogleAnalyticsConsent(consent: boolean): void {
  Cookies.set(GoogleAnalyticsConsentKey, JSON.stringify(consent), {
    expires: 365,
    sameSite: "strict",
  });
}

//# endregion

//# region backend

export function getLocalStorageBackendURL() {
  return localStorage.getItem(BackendURLKey);
}

export function setLocalStorageBackendURL(url: string) {
  localStorage.setItem(BackendURLKey, url);
}

export function clearLocalStorageBackendURL(): void {
  localStorage.removeItem(BackendURLKey);
}

//# endregion
