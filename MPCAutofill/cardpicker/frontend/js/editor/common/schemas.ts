export const searchTypeSettingsSchema = {
  type: "object",
  properties: {
    fuzzySearch: {
      description: "Whether fuzzy search is enabled",
      type: "boolean",
    },
  },
  required: ["fuzzySearch"],
} as const;

export const sourceRowSchema = {
  type: "array",
  items: [
    {
      type: "number",
      description: "The source's primary key",
      minimum: 0,
    },
    {
      type: "boolean",
      description: "Whether the source is enabled for searching",
    },
  ],
  minItems: 2,
  maxItems: 2,
} as const;

export const sourceSettingsSchema = {
  // $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    sources: {
      description: "The list of sources in the order they should be searched",
      type: ["array", "null"],
      items: sourceRowSchema,
      // items: false,
      // uniqueItems: true,
    },
  },
  required: ["sources"],
} as const;

export const filterSettingsSchema = {
  type: "object",
  properties: {
    minimumDPI: {
      type: "number",
      description:
        "The minimum DPI that cards must meet to be included in search results",
      minimum: 0,
    },
    maximumDPI: {
      type: "number",
      description:
        "The maximum DPI that cards can meet to be included in search results",
      minimum: 0,
    },
    maximumSize: {
      type: "number",
      description:
        "The maximum filesize that cards can have to be included in search results",
      minimum: 0,
    },
  },
  required: ["minimumDPI", "maximumDPI", "maximumSize"],
} as const;

export const searchSettingsSchema = {
  title: "Search settings schema",
  type: "object",
  properties: {
    searchTypeSettings: searchTypeSettingsSchema,
    sourceSettings: sourceSettingsSchema,
    filterSettings: filterSettingsSchema,
  },
  required: ["searchTypeSettings", "sourceSettings", "filterSettings"],
  additionalProperties: false,
} as const;
