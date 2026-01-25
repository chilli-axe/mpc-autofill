/**
 * Data API for interacting with anything stored in cookies or local storage.
 */

import Cookies from "js-cookie";

import {
  BackendURLKey,
  CSRFKey,
  FavoritesKey,
  GoogleAnalyticsConsentKey,
  SearchSettingsKey,
} from "@/common/constants";
import { Convert } from "@/common/schema_types";
import { SearchSettings, SourceDocuments, SourceRow } from "@/common/types";
import { getSourceRowsFromSourceSettings } from "@/common/utils";
import { FavoritesState } from "@/store/slices/favoritesSlice";
import { getDefaultSearchSettings } from "@/store/slices/searchSettingsSlice";

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

//# region favorites

/**
 * Get favorites from localStorage data.
 * Returns empty object if no valid data is found.
 */
export function getLocalStorageFavorites(): FavoritesState["favoriteRenders"] {
  const serialisedRawFavorites = localStorage.getItem(FavoritesKey);
  if (serialisedRawFavorites == null) {
    return {};
  }
  try {
    const parsed = JSON.parse(serialisedRawFavorites);
    // Validate that it's an object with string keys and array values
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      // Validate all values are arrays of strings
      const isValid = Object.values(parsed).every(
        (value) =>
          Array.isArray(value) &&
          value.every((item) => typeof item === "string")
      );
      if (isValid) {
        return parsed as FavoritesState["favoriteRenders"];
      }
    }
    return {};
  } catch (e) {
    // Invalid JSON or structure, return empty object
    return {};
  }
}

export function setLocalStorageFavorites(
  favoriteRenders: FavoritesState["favoriteRenders"]
): void {
  localStorage.setItem(FavoritesKey, JSON.stringify(favoriteRenders));
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
