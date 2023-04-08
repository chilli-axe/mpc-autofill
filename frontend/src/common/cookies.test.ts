import { getCookieSearchSettings } from "./cookies";
import Cookies from "js-cookie";
import { SourceDocuments } from "./types";
import { MaximumDPI, MaximumSize, MinimumDPI } from "./constants";

//# region constants

const sourceDocuments: SourceDocuments = {
  0: {
    pk: 0,
    key: "source_1",
    name: "Source 1",
    identifier: "id_1",
    source_type: "gdrive",
    external_link: undefined,
    description: "",
  },
  1: {
    pk: 1,
    key: "source_2",
    name: "Source 2",
    identifier: "id_2",
    source_type: "gdrive",
    external_link: undefined,
    description: "",
  },
  2: {
    pk: 2,
    key: "source_3",
    name: "Source 3",
    identifier: "id_3",
    source_type: "gdrive",
    external_link: undefined,
    description: "",
  },
  3: {
    pk: 3,
    key: "source_4",
    name: "Source 4",
    identifier: "id_4",
    source_type: "gdrive",
    external_link: undefined,
    description: "",
  },
};

const defaultSettings = {
  searchTypeSettings: { fuzzySearch: false },
  sourceSettings: {
    sources: [
      [0, true],
      [1, true],
      [2, true],
      [3, true],
    ],
  },
  filterSettings: {
    minimumDPI: MinimumDPI,
    maximumDPI: MaximumDPI,
    maximumSize: MaximumSize,
  },
};

//# endregion

//# region mocks

const mockGetCookies = jest.fn();
const mockSetCookies = jest.fn();

jest.mock("js-cookie", () => ({
  __esModule: true,
  default: {
    set: jest.fn().mockImplementation((...args) => {
      mockSetCookies(...args);
    }),
    get: jest.fn().mockImplementation((...args) => {
      mockGetCookies(...args);
    }),
  },
}));

//# endregion

//# region tests

test("default settings are returned when cookies are empty", () => {
  (Cookies.get as jest.Mock).mockReturnValue(JSON.stringify({}));

  expect(getCookieSearchSettings(sourceDocuments)).toStrictEqual(
    defaultSettings
  );
});

test("default settings are returned when cookie data doesn't match schema", () => {
  // some arbitrary garbage json data
  (Cookies.get as jest.Mock).mockReturnValue(
    JSON.stringify({ a: 1, b: 2, garbage: true })
  );

  expect(getCookieSearchSettings(sourceDocuments)).toStrictEqual(
    defaultSettings
  );
});

test("cookies with complete source order are respected", () => {
  // setting up some arbitrary non-default settings here
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true },
    sourceSettings: {
      sources: [
        [1, true],
        [0, false],
        [3, true],
        [2, false],
      ],
    },
    filterSettings: { minimumDPI: 100, maximumDPI: 200, maximumSize: 15 },
  };
  (Cookies.get as jest.Mock).mockReturnValue(
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  expect(getCookieSearchSettings(sourceDocuments)).toStrictEqual(
    settingsWithCompleteSourceOrder
  );
});

test("referenced sources that don't exist in database are filtered out", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: false },
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
    },
  };
  (Cookies.get as jest.Mock).mockReturnValue(
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  expect(
    getCookieSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, true],
    [3, true],
    [2, true],
  ]);
});

test("cookies with incomplete source order are correctly reconciled", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true },
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
    },
  };
  (Cookies.get as jest.Mock).mockReturnValue(
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  // sources 2 and 3 should be added onto the end and enabled
  expect(
    getCookieSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, false],
    [2, true],
    [3, true],
  ]);
});

test("cookies with incomplete source order plus invalid sources are correctly reconciled", () => {
  const settingsWithCompleteSourceOrder = {
    searchTypeSettings: { fuzzySearch: true },
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
    },
  };
  (Cookies.get as jest.Mock).mockReturnValue(
    JSON.stringify(settingsWithCompleteSourceOrder)
  );

  // sources 2 and 3 should be added onto the end and enabled
  expect(
    getCookieSearchSettings(sourceDocuments).sourceSettings.sources
  ).toStrictEqual([
    [1, true],
    [0, false],
    [2, true],
    [3, true],
  ]);
});

//# endregion
