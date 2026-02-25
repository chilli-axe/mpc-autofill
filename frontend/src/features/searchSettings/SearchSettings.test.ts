import {
  FilterSettings,
  SearchTypeSettings,
  SourceSettings,
} from "@/common/types";

import {
  areSetsEqual,
  compareFilterSettings,
  compareSearchTypeSettings,
  compareSourceSettings,
  sourceSettingsToSet,
} from "./SearchSettings";

describe("areSetsEqual", () => {
  test.each([
    ["two empty sets", new Set(), new Set()],
    ["two identical sets", new Set([1, 2, 3]), new Set([1, 2, 3])],
    [
      "sets with same elements in different order",
      new Set([3, 1, 2]),
      new Set([1, 2, 3]),
    ],
  ])("returns true for %s", (description, a, b) => {
    expect(areSetsEqual(a, b)).toBe(true);
  });

  test.each([
    ["sets with different sizes", new Set([1, 2, 3]), new Set([1, 2])],
    [
      "sets with same size but different elements",
      new Set([1, 2, 3]),
      new Set([1, 2, 4]),
    ],
    ["first set has more elements", new Set([1, 2, 3, 4]), new Set([1, 2, 3])],
    ["second set has more elements", new Set([1, 2, 3]), new Set([1, 2, 3, 4])],
  ])("returns false for %s", (description, a, b) => {
    expect(areSetsEqual(a, b)).toBe(false);
  });
});

describe("sourceSettingsToSet", () => {
  test("returns empty set when no sources are enabled", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, false],
        [1, false],
        [2, false],
      ],
    };
    expect(sourceSettingsToSet(sourceSettings)).toEqual(new Set());
  });

  test("returns set with single enabled source", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, false],
        [2, false],
      ],
    };
    expect(sourceSettingsToSet(sourceSettings)).toEqual(new Set([0]));
  });

  test("returns set with all enabled sources", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, true],
        [2, true],
      ],
    };
    expect(sourceSettingsToSet(sourceSettings)).toEqual(new Set([0, 1, 2]));
  });

  test("returns set with mixed enabled sources", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, false],
        [2, true],
        [3, false],
        [4, true],
      ],
    };
    expect(sourceSettingsToSet(sourceSettings)).toEqual(new Set([0, 2, 4]));
  });

  test("handles empty sources array", () => {
    const sourceSettings: SourceSettings = {
      sources: [],
    };
    expect(sourceSettingsToSet(sourceSettings)).toEqual(new Set());
  });
});

describe("compareFilterSettings", () => {
  const defaultFilterSettings: FilterSettings = {
    excludesTags: [],
    includesTags: [],
    languages: ["en"],
    maximumDPI: 1200,
    maximumSize: 100,
    minimumDPI: 300,
  };

  test("returns 0 when settings are identical", () => {
    const filterSettings: FilterSettings = {
      excludesTags: [],
      includesTags: [],
      languages: ["en"],
      maximumDPI: 1200,
      maximumSize: 100,
      minimumDPI: 300,
    };
    expect(compareFilterSettings(filterSettings, defaultFilterSettings)).toBe(
      0
    );
  });

  test.each([
    ["excludesTags", { excludesTags: ["tag1"] }],
    ["includesTags", { includesTags: ["tag1"] }],
    ["languages", { languages: ["en", "es"] }],
    ["maximumDPI", { maximumDPI: 1500 }],
    ["maximumSize", { maximumSize: 200 }],
    ["minimumDPI", { minimumDPI: 600 }],
  ])("returns 1 when only %s differs", (fieldName, override) => {
    const filterSettings: FilterSettings = {
      ...defaultFilterSettings,
      ...override,
    };
    expect(compareFilterSettings(filterSettings, defaultFilterSettings)).toBe(
      1
    );
  });

  test("returns 3 when three settings differ", () => {
    const filterSettings: FilterSettings = {
      ...defaultFilterSettings,
      excludesTags: ["tag1"],
      maximumDPI: 1500,
      minimumDPI: 600,
    };
    expect(compareFilterSettings(filterSettings, defaultFilterSettings)).toBe(
      3
    );
  });

  test("returns 6 when all settings differ", () => {
    const filterSettings: FilterSettings = {
      excludesTags: ["tag1"],
      includesTags: ["tag2"],
      languages: ["es"],
      maximumDPI: 1500,
      maximumSize: 200,
      minimumDPI: 600,
    };
    expect(compareFilterSettings(filterSettings, defaultFilterSettings)).toBe(
      6
    );
  });

  test("treats arrays with same elements in different order as equal", () => {
    const defaultSettings: FilterSettings = {
      ...defaultFilterSettings,
      languages: ["en", "es", "fr"],
    };
    const filterSettings: FilterSettings = {
      ...defaultSettings,
      languages: ["fr", "en", "es"],
    };
    expect(compareFilterSettings(filterSettings, defaultSettings)).toBe(0);
  });
});

describe("compareSearchTypeSettings", () => {
  const defaultSearchTypeSettings: SearchTypeSettings = {
    filterCardbacks: false,
    fuzzySearch: false,
  };

  test("returns 0 when settings are identical", () => {
    const searchTypeSettings: SearchTypeSettings = {
      filterCardbacks: false,
      fuzzySearch: false,
    };
    expect(
      compareSearchTypeSettings(searchTypeSettings, defaultSearchTypeSettings)
    ).toBe(0);
  });

  test.each([
    ["filterCardbacks", { filterCardbacks: true, fuzzySearch: false }],
    ["fuzzySearch", { filterCardbacks: false, fuzzySearch: true }],
  ])("returns 1 when only %s differs", (fieldName, searchTypeSettings) => {
    expect(
      compareSearchTypeSettings(searchTypeSettings, defaultSearchTypeSettings)
    ).toBe(1);
  });

  test("returns 2 when both settings differ", () => {
    const searchTypeSettings: SearchTypeSettings = {
      filterCardbacks: true,
      fuzzySearch: true,
    };
    expect(
      compareSearchTypeSettings(searchTypeSettings, defaultSearchTypeSettings)
    ).toBe(2);
  });
});

describe("compareSourceSettings", () => {
  const defaultSourceSettings: SourceSettings = {
    sources: [
      [0, true],
      [1, true],
      [2, false],
    ],
  };

  test("returns 0 when settings are identical", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, true],
        [2, false],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      0
    );
  });

  test("returns 1 when one source is toggled", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, false],
        [2, false],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      1
    );
  });

  test("returns 2 when two sources are toggled", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, false],
        [1, false],
        [2, false],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      2
    );
  });

  test("returns correct count when sources are enabled in different order", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [2, false],
        [0, true],
        [1, true],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      0
    );
  });

  test("returns 3 when a different source is enabled", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, true],
        [1, true],
        [2, true],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      1
    );
  });

  test("returns correct count with completely different sources", () => {
    const sourceSettings: SourceSettings = {
      sources: [
        [0, false],
        [1, false],
        [2, true],
        [3, true],
      ],
    };
    expect(compareSourceSettings(sourceSettings, defaultSourceSettings)).toBe(
      4
    );
  });
});
