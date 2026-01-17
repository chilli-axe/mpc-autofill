import {
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  SearchSettingsKey,
} from "@/common/constants";
import { getLocalStorageSearchSettings } from "@/common/cookies";
import { defaultSettings, sourceDocuments } from "@/common/test-constants";

beforeEach(() => window.localStorage.removeItem(SearchSettingsKey));
afterEach(() => window.localStorage.removeItem(SearchSettingsKey));

//# region tests

test("default settings are returned when cookies are empty", () => {
  window.localStorage.setItem(SearchSettingsKey, JSON.stringify({}));

  expect(getLocalStorageSearchSettings(sourceDocuments)).toStrictEqual(
    defaultSettings
  );
});

test("default settings are returned when cookie data doesn't match schema", () => {
  // some arbitrary garbage json data
  window.localStorage.setItem(
    SearchSettingsKey,
    JSON.stringify({ a: 1, b: 2, garbage: true })
  );

  expect(getLocalStorageSearchSettings(sourceDocuments)).toStrictEqual(
    defaultSettings
  );
});

test("cookies with complete source order are respected", () => {
  // setting up some arbitrary non-default settings here
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true, filterCardbacks: false },
    sourceSettings: {
      sources: [
        [1, true],
        [0, false],
        [3, true],
        [2, false],
      ],
    },
    filterSettings: {
      minimumDPI: 100,
      maximumDPI: 200,
      maximumSize: 15,
      languages: [],
      includesTags: [],
      excludesTags: ["NSFW"],
    },
  };
  window.localStorage.setItem(
    SearchSettingsKey,
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  expect(getLocalStorageSearchSettings(sourceDocuments)).toStrictEqual(
    settingsWithCompleteSourceOrder
  );
});

test("referenced sources that don't exist in database are filtered out", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
    sourceSettings: {
      sources: [
        [1, true],
        [0, true],
        [3, true],
        [2, true],
        [5, true],
        [6, true],
      ],
    },
    filterSettings: {
      minimumDPI: MinimumDPI,
      maximumDPI: MaximumDPI,
      maximumSize: MaximumSize,
      languages: [],
      includesTags: [],
      excludesTags: ["NSFW"],
    },
  };
  window.localStorage.setItem(
    SearchSettingsKey,
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  expect(
    getLocalStorageSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, true],
    [3, true],
    [2, true],
  ]);
});

test("cookies with incomplete source order are correctly reconciled", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true, filterCardbacks: false },
    sourceSettings: {
      sources: [
        [1, true],
        [0, false],
      ],
    },
    filterSettings: {
      minimumDPI: MinimumDPI,
      maximumDPI: MaximumDPI,
      maximumSize: MaximumSize,
      languages: [],
      includesTags: [],
      excludesTags: ["NSFW"],
    },
  };
  window.localStorage.setItem(
    SearchSettingsKey,
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  // sources 2 and 3 should be added onto the end and active
  expect(
    getLocalStorageSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, false],
    [2, true],
    [3, true],
  ]);
});

test("cookies with incomplete source order plus invalid sources are correctly reconciled", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true, filterCardbacks: false },
    sourceSettings: {
      sources: [
        [6, true],
        [1, true],
        [0, false],
        [5, false],
      ],
    },
    filterSettings: {
      minimumDPI: MinimumDPI,
      maximumDPI: MaximumDPI,
      maximumSize: MaximumSize,
      languages: [],
      includesTags: [],
      excludesTags: ["NSFW"],
    },
  };
  window.localStorage.setItem(
    SearchSettingsKey,
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  // sources 2 and 3 should be added onto the end and active
  expect(
    getLocalStorageSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, false],
    [2, true],
    [3, true],
  ]);
});

//# endregion
