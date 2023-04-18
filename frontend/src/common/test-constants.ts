/**
 * Some pre-built objects which can be used to build up Redux state for tests.
 */

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
import { Card, MaximumDPI, MaximumSize, MinimumDPI } from "@/common/constants";

//# region backend

export const localBackendURL = "https://127.0.0.1:8000";
export const localBackend: BackendState = { url: localBackendURL };

//# endregion

//# region sources

export const sourceDocument1: SourceDocument = {
  pk: 0,
  key: "source_1",
  name: "Source 1",
  identifier: "id_1",
  source_type: "gdrive",
  external_link: null,
  description: "",
};

export const sourceDocument2: SourceDocument = {
  pk: 1,
  key: "source_2",
  name: "Source 2",
  identifier: "id_2",
  source_type: "gdrive",
  external_link: null,
  description: "",
};

export const sourceDocument3: SourceDocument = {
  pk: 2,
  key: "source_3",
  name: "Source 3",
  identifier: "id_3",
  source_type: "gdrive",
  external_link: null,
  description: "",
};

export const sourceDocument4: SourceDocument = {
  pk: 3,
  key: "source_4",
  name: "Source 4",
  identifier: "id_4",
  source_type: "gdrive",
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
  source: "Card Source",
  source_id: sourceDocument1.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 1",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

export const cardDocument2: CardDocument = {
  identifier: "abc1234",
  card_type: "CARD",
  name: "Card 2",
  priority: 0,
  source: "Card Source",
  source_id: sourceDocument1.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 2",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

export const cardDocument3: CardDocument = {
  identifier: "abc12345",
  card_type: "CARD",
  name: "Card 3",
  priority: 0,
  source: "Card Source",
  source_id: sourceDocument1.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 3",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

export const cardDocument4: CardDocument = {
  identifier: "abc123456",
  card_type: "CARD",
  name: "Card 4",
  priority: 0,
  source: "Card Source",
  source_id: sourceDocument1.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 4",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

export const cardDocument5: CardDocument = {
  identifier: "abc1234567",
  card_type: "CARDBACK",
  name: "Card 5",
  priority: 0,
  source: "Card Source",
  source_id: sourceDocument2.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 5",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

export const cardDocument6: CardDocument = {
  identifier: "abc12345678",
  card_type: "TOKEN",
  name: "Card 6",
  priority: 0,
  source: "Card Source",
  source_id: sourceDocument3.pk,
  source_verbose: "Card Source",
  source_type: "google drive",
  dpi: 1200,
  searchq: "card 6",
  extension: "png",
  date: "1st January, 2000", // formatted by backend
  download_link: "",
  size: 10_000_000,
  small_thumbnail_url: "",
  medium_thumbnail_url: "",
};

//# endregion

//# region project

export const projectSelectedImage1: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", card_type: Card },
        selectedImage: cardDocument1.identifier,
      },
      back: null,
    },
  ],
  cardback: null,
};

export const projectSelectedImage2: Project = {
  members: [
    {
      front: {
        query: { query: "my search query", card_type: Card },
        selectedImage: cardDocument2.identifier,
      },
      back: null,
    },
  ],
  cardback: null,
};

//# endregion

//# region search settings

export const defaultSettings: SearchSettings = {
  searchTypeSettings: { fuzzySearch: false },
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
  },
};

//# endregion
