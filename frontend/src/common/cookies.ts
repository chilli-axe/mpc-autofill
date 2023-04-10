/**
 * Data API for interacting with anything stored in cookies.
 */

import Cookies from "js-cookie";
import Ajv from "ajv";
import {
  SearchSettings,
  SourceDocument,
  SourceDocuments,
  SourceRow,
} from "./types";
import { searchSettingsSchema } from "./schemas";
import {
  CSRFCookie,
  SearchSettingsCookie,
  GoogleAnalyticsConsentCookie,
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  BackendURLCookie,
} from "./constants";

const ajv = new Ajv();

//# region CSRF
// TODO: unsure if we still need this.

export function getCSRFHeader(): HeadersInit | undefined {
  const csrfToken = Cookies.get(CSRFCookie);
  if (csrfToken != null) {
    return { "X-CSRFToken": csrfToken };
  }
  return undefined;
}

//# endregion

//# region search settings

export function getCookieSearchSettings(
  sourceDocuments: SourceDocuments
): SearchSettings {
  /**
   * Get search settings from cookie data. If valid data is retrieved,
   * ensure that all `sourceDocuments` are included in the returned settings,
   * with any new sources that weren't previously included added to the end and enabled.
   */

  const rawSettings = JSON.parse(Cookies.get(SearchSettingsCookie) ?? "{}");
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
    // default settings
    return {
      searchTypeSettings: { fuzzySearch: false },
      sourceSettings: {
        sources: Object.values(sourceDocuments).map(
          (sourceDocument: SourceDocument) => [sourceDocument.pk, true]
        ),
      },
      filterSettings: {
        minimumDPI: MinimumDPI,
        maximumDPI: MaximumDPI,
        maximumSize: MaximumSize,
      },
    };
  }
}

export function setCookieSearchSettings(settings: SearchSettings): void {
  Cookies.set(SearchSettingsCookie, JSON.stringify(settings), {
    expires: 365,
    sameSite: "strict",
  });
}

//# endregion

//# region google analytics consent

export function getGoogleAnalyticsConsent(): boolean | undefined {
  const rawConsent = Cookies.get(GoogleAnalyticsConsentCookie);
  return rawConsent != undefined ? JSON.parse(rawConsent) === true : undefined;
}

export function setGoogleAnalyticsConsent(consent: boolean): void {
  Cookies.set(GoogleAnalyticsConsentCookie, JSON.stringify(consent), {
    expires: 365,
    sameSite: "strict",
  });
}

//# endregion

//# region backend

export function getCookieBackendURL(): string | undefined {
  return Cookies.get(BackendURLCookie);
}

export function setCookieBackendURL(url: string): void {
  Cookies.set(BackendURLCookie, url, {
    expires: 365,
    sameSite: "strict",
  });
}

export function clearCookieBackendURL(): void {
  Cookies.remove(BackendURLCookie);
}

//# endregion
