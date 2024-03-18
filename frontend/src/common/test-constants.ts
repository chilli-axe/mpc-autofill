/**
 * Some pre-built objects which can be used to build up Redux state for tests.
 */

import { Card, MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";
import {
  BackendState,
  CardDocument,
  CardDocumentsState,
  Project,
  SearchResultsState,
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
  identifier: "id_1",
  source_type: "Google Drive",
  external_link: null,
  description: "",
};

export const sourceDocument2: SourceDocument = {
  pk: 1,
  key: "source_2",
  name: "Source 2",
  identifier: "id_2",
  source_type: "Google Drive",
  external_link: null,
  description: "",
};

export const sourceDocument3: SourceDocument = {
  pk: 2,
  key: "source_3",
  name: "Source 3",
  identifier: "id_3",
  source_type: "Google Drive",
  external_link: null,
  description: "",
};

export const sourceDocument4: SourceDocument = {
  pk: 3,
  key: "source_4",
  name: "Source 4",
  identifier: "id_4",
  source_type: "Google Drive",
  external_link: null,
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
  card_type: "CARD",
  name: "Card 1",
  priority: 0,
  source: sourceDocument1.key,
  source_name: sourceDocument1.name,
  source_id: sourceDocument1.pk,
  source_verbose: sourceDocument1.name,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 1",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

export const cardDocument2: CardDocument = {
  identifier: "abc1234",
  card_type: "CARD",
  name: "Card 2",
  priority: 0,
  source: sourceDocument1.key,
  source_name: sourceDocument1.name,
  source_id: sourceDocument1.pk,
  source_verbose: sourceDocument1.name,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 2",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

export const cardDocument3: CardDocument = {
  identifier: "abc12345",
  card_type: "CARD",
  name: "Card 3",
  priority: 0,
  source: sourceDocument1.key,
  source_name: sourceDocument1.name,
  source_id: sourceDocument1.pk,
  source_verbose: sourceDocument1.name,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 3",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

export const cardDocument4: CardDocument = {
  identifier: "abc123456",
  card_type: "CARD",
  name: "Card 4",
  priority: 0,
  source: sourceDocument1.key,
  source_name: sourceDocument1.name,
  source_id: sourceDocument1.pk,
  source_verbose: sourceDocument1.name,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 4",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

export const cardDocument5: CardDocument = {
  identifier: "abc1234567",
  card_type: "CARDBACK",
  name: "Card 5",
  priority: 0,
  source: sourceDocument2.key,
  source_name: sourceDocument2.name,
  source_id: sourceDocument2.pk,
  source_verbose: `${sourceDocument2.name} Cardbacks`,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 5",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

export const cardDocument6: CardDocument = {
  identifier: "abc12345678",
  card_type: "TOKEN",
  name: "Card 6",
  priority: 0,
  source: sourceDocument3.key,
  source_name: sourceDocument3.name,
  source_id: sourceDocument3.pk,
  source_verbose: `${sourceDocument3.name} Tokens`,
  source_type: "Google Drive",
  source_external_link: null,
  dpi: 1200,
  searchq: "card 6",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
  language: "EN",
  tags: [],
};

//# endregion

//# region project

export const projectSelectedImage1: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", card_type: Card },
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
        query: { query: "my search query", card_type: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "my search query", card_type: Card },
        selectedImage: cardDocument1.identifier,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "my search query", card_type: Card },
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
        query: { query: "my search query", card_type: Card },
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
