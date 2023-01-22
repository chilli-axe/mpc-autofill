/**
 * Data API for interacting with anything stored in cookies.
 * TODO: move the functionality for checking if users consent to Google Analytics tracking to here.
 */

import Cookies from "js-cookie";

export interface CookieSearchSettings {
  fuzzySearch: boolean;
  drives: Array<[string, boolean]>;
}

export function getSearchSettings(): CookieSearchSettings | null {
  const rawSettings = Cookies.get("searchSettings");
  if (rawSettings == null) {
    return null;
  }
  const parsedSettings = JSON.parse(rawSettings);
  if (
    parsedSettings["fuzzySearch"] != null &&
    parsedSettings["drives"] != null &&
    parsedSettings["drives"].length > 0
  ) {
    return parsedSettings;
  } else {
    return null;
  }
}

export function setSearchSettings(settings: CookieSearchSettings): void {
  Cookies.set("searchSettings", JSON.stringify(settings));
}
