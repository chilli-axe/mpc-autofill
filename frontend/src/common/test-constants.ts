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

export const localBackendURL = "https://127.0.0.1:8000";
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
  identifier: "abc123",
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
  searchq: "card 1",
  extension: "png",
  dateCreated: "1st January, 2000", // formatted by backend
  dateModified: "1st January, 2000", // formatted by backend
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument2: CardDocument = {
  identifier: "abc1234",
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
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument3: CardDocument = {
  identifier: "abc12345",
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
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument4: CardDocument = {
  identifier: "abc123456",
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
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument5: CardDocument = {
  identifier: "abc1234567",
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
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
};

export const cardDocument6: CardDocument = {
  identifier: "abc12345678",
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
  downloadLink: "",
  size: 10_000_000,
  smallThumbnailUrl: "",
  mediumThumbnailUrl: "",
  language: "EN",
  tags: [],
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
