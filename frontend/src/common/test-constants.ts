/**
 * Some pre-built objects which can be used to build up Redux state for tests.
 */

import { Card, MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";
import { CardType as CardTypeSchema, SourceType } from "@/common/schema_types";
import {
  BackendState,
  CardDocument,
  Project,
  SearchSettings,
  SourceDocument,
  SourceDocuments,
} from "@/common/types";

//# region backend

export const localBackendURL = "http://127.0.0.1:8000";
export const localBackend: BackendState = { url: localBackendURL };
export const noBackend: BackendState = { url: null };

//# endregion

//# region sources

export const sourceDocument1: SourceDocument = {
  pk: 0,
  key: "source_1",
  name: "Source 1",
  sourceType: SourceType.GoogleDrive,
  externalLink: undefined,
  description: "",
};

export const sourceDocument2: SourceDocument = {
  pk: 1,
  key: "source_2",
  name: "Source 2",
  sourceType: SourceType.GoogleDrive,
  externalLink: undefined,
  description: "",
};

export const sourceDocument3: SourceDocument = {
  pk: 2,
  key: "source_3",
  name: "Source 3",
  sourceType: SourceType.GoogleDrive,
  externalLink: undefined,
  description: "",
};

export const sourceDocument4: SourceDocument = {
  pk: 3,
  key: "source_4",
  name: "Source 4",
  sourceType: SourceType.GoogleDrive,
  externalLink: undefined,
  description: "",
};

export const sourceDocuments: SourceDocuments = {
  [sourceDocument1.pk]: sourceDocument1,
  [sourceDocument2.pk]: sourceDocument2,
  [sourceDocument3.pk]: sourceDocument3,
  [sourceDocument4.pk]: sourceDocument4,
};

//# endregion

//# region cards

export const cardDocument1: CardDocument = {
  identifier: "1c4M-sK9gd0Xju0NXCPtqeTW_DQTldVU5",
  cardType: CardTypeSchema.Card,
  name: "Card 1",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card one",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument2: CardDocument = {
  identifier: "1IDtqSjJ4Yo45AnNA4SplOiN7ewibifMa",
  cardType: CardTypeSchema.Card,
  name: "Card 2",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 2",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument3: CardDocument = {
  identifier: "1HsvTYs1jFGe1c8U1PnNZ9aB8jkAW7KU0",
  cardType: CardTypeSchema.Card,
  name: "Card 3",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 3",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument4: CardDocument = {
  identifier: "1-dcs0FEE05MTGiYbKqs9HnRdhXkgtIJG",
  cardType: CardTypeSchema.Card,
  name: "Card 4",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 4",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument5: CardDocument = {
  identifier: "1JtXL6Ca9nQkvhwZZRR9ZuKA9_DzsFf1V",
  cardType: CardTypeSchema.Cardback,
  name: "Card 5",
  priority: 0,
  source: sourceDocument2.key,
  sourceName: sourceDocument2.name,
  sourceId: sourceDocument2.pk,
  sourceVerbose: `${sourceDocument2.name} Cardbacks`,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 5",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument6: CardDocument = {
  identifier: "1oigI6wz0zA--pNMuExKTs40kBNH6VRP_",
  cardType: CardTypeSchema.Token,
  name: "Card 6",
  priority: 0,
  source: sourceDocument3.key,
  sourceName: sourceDocument3.name,
  sourceId: sourceDocument3.pk,
  sourceVerbose: `${sourceDocument3.name} Tokens`,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 6",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

// Card from source2 (for multi-source grid selector tests)
export const cardDocument7: CardDocument = {
  identifier: "1aA2bB3cC4dD5eE6fF7gG8hH9iI0jJ",
  cardType: CardTypeSchema.Card,
  name: "Card 7",
  priority: 0,
  source: sourceDocument2.key,
  sourceName: sourceDocument2.name,
  sourceId: sourceDocument2.pk,
  sourceVerbose: sourceDocument2.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 7",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

// Cards with canonicalCard data (for CanonicalCardFilter tests)
export const cardDocument8: CardDocument = {
  identifier: "1bB2cC3dD4eE5fF6gG7hH8iI9jJ0kK",
  cardType: CardTypeSchema.Card,
  name: "Card 8",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 8",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
  canonicalCard: {
    expansionCode: "xyz",
    expansionName: "XYZ Set",
    collectorNumber: "001",
    identifier: "xyz-001",
    smallThumbnailUrl: "",
    mediumThumbnailUrl: "",
  },
  canonicalArtist: {
    name: "Alpha Artist",
  },
};

export const cardDocument9: CardDocument = {
  identifier: "1cC2dD3eE4fF5gG6hH7iI8jJ9kK0lL",
  cardType: CardTypeSchema.Card,
  name: "Card 9",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 9",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
  canonicalCard: {
    expansionCode: "xyz",
    expansionName: "XYZ Set",
    collectorNumber: "002",
    identifier: "xyz-002",
    smallThumbnailUrl: "",
    mediumThumbnailUrl: "",
  },
  canonicalArtist: {
    name: "Beta Artist",
  },
};

export const cardDocument10: CardDocument = {
  identifier: "1dD2eE3fF4gG5hH6iI7jJ8kK9lL0mM",
  cardType: CardTypeSchema.Card,
  name: "Card 10",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 10",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
  canonicalCard: {
    expansionCode: "abc",
    expansionName: "ABC Set",
    collectorNumber: "001",
    identifier: "abc-001",
    smallThumbnailUrl: "",
    mediumThumbnailUrl: "",
  },
  canonicalArtist: {
    name: "Alpha Artist",
  },
};

// Card with no canonicalCard data (for Unknown handling in CanonicalCardFilter)
export const cardDocument11: CardDocument = {
  identifier: "1eE2fF3gG4hH5iI6jJ7kK8lL9mM0nN",
  cardType: CardTypeSchema.Card,
  name: "Card 11",
  priority: 0,
  source: sourceDocument1.key,
  sourceName: sourceDocument1.name,
  sourceId: sourceDocument1.pk,
  sourceVerbose: sourceDocument1.name,
  sourceType: SourceType.GoogleDrive,
  sourceExternalLink: undefined,
  dpi: 1200,
  searchq: "card 11",
  extension: "png",
  dateCreated: "1st January, 2000",
  dateModified: "1st January, 2000",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
  canonicalCard: null,
};

//# endregion

//# region project

export const projectSelectedImage1: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", cardType: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
  ],
  cardback: null,
  mostRecentlySelectedSlot: null,
};

export const projectThreeMembersSelectedImage1: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", cardType: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "my search query", cardType: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "my search query", cardType: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
  ],
  cardback: null,
  mostRecentlySelectedSlot: null,
};

export const projectSelectedImage2: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", cardType: Card },
        selectedImage: cardDocument2.identifier,
        selected: false,
      },
      back: null,
    },
  ],
  cardback: null,
  mostRecentlySelectedSlot: null,
};

//# endregion

//# region search settings

export const defaultSettings: SearchSettings = {
  searchTypeSettings: { fuzzySearch: false, filterCardbacks: false },
  sourceSettings: {
    sources: [
      [sourceDocument1.pk, true],
      [sourceDocument2.pk, true],
      [sourceDocument3.pk, true],
      [sourceDocument4.pk, true],
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

//# endregion
