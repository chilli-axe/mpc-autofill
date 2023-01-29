export type CardType = "CARD" | "CARDBACK" | "TOKEN";
export type Faces = "front" | "back";

export interface CardDocument {
  // This should match the data returned by `to_dict` on the `Card` Django model
  identifier: string;
  card_type: string;
  name: string;
  priority: number;
  source: string;
  source_verbose: string;
  source_type: string;
  dpi: number;
  searchq: string;
  extension: string;
  date: string; // formatted by backend
  download_link: string;
  size: number;
  small_thumbnail_url: string;
  medium_thumbnail_url: string;
}

export interface CardDocuments {
  [key: string]: CardDocument;
}

export interface CardDocumentsState {
  cardDocuments: CardDocuments;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string;
}

export interface CardbacksState {
  cardbacks: Array<string>;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string;
}

export interface SourceDocument {
  // This should match the data returned by `to_dict` on the `Source` Django model
  pk: number;
  key: string;
  name: string;
  identifier: string;
  source_type: string; // TODO
  external_link?: string;
  description: string;
}

export interface SourceDocuments {
  [key: string]: SourceDocument;
}

export interface SourceDocumentsState {
  sourceDocuments?: SourceDocuments;
}

export type SearchResultsForQuery = {
  [card_type in CardType]: Array<string>;
};

export interface SearchResults {
  [query: string]: SearchResultsForQuery;
}

export interface SearchResultsState {
  searchResults: SearchResults;
  status: string;
  error: string;
}

export type SourceRow = [string, boolean];

export interface SearchSettingsState {
  fuzzySearch: boolean;
  cardSources?: Array<SourceRow>;
  // cardbackSources: Array<string>;  // TODO: reconsider this. maybe a toggle for whether cardbacks should be filtered?
  minDPI: number;
  maxDPI: number;
  maxSize: number;
}

export interface ImportSite {
  name: string;
  url: string;
}

export interface SearchQuery {
  query: string | null;
  card_type: CardType; // TODO: rename this to `cardType`
}

export interface ProjectMember {
  query: SearchQuery;
  selectedImage?: string;
}

export type SlotProjectMembers = {
  [face in Faces]: ProjectMember | null;
};

export type Project = {
  members: Array<SlotProjectMembers>;
  cardback: string | null;
};

export interface CookieSearchSettings {
  fuzzySearch: boolean;
  drives: Array<[string, boolean]>;
}

export interface DFCPairs {
  [front: string]: string;
}

export type ProcessedLine = [number, SearchQuery?, SearchQuery?];
