import { FromSchema } from "json-schema-to-ts";

import {
  filterSettingsSchema,
  searchSettingsSchema,
  searchTypeSettingsSchema,
  sourceRowSchema,
  sourceSettingsSchema,
} from "@/common/schemas";

export type CardType = "CARD" | "CARDBACK" | "TOKEN";
export type Faces = "front" | "back";

export interface CardDocument {
  // This should match the data returned by `to_dict` on the `Card` Django model
  identifier: string;
  card_type: string;
  name: string;
  priority: number;
  source: string;
  source_name: string;
  source_id: number;
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
  error: string | null;
}

export interface CardbacksState {
  cardbacks: Array<string>;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

// TODO: create json schemas for these, infer types from them, and see if we can define the schema once between frontend and backend
// TODO: it seems DRF serialisers can accomplish this: https://www.django-rest-framework.org/api-guide/serializers/
export interface SourceDocument {
  // This should match the data returned by `to_dict` on the `Source` Django model
  pk: number;
  key: string;
  name: string;
  identifier: string;
  source_type: string; // TODO
  external_link: string | null;
  description: string;
}

export interface SourceDocuments {
  [pk: number]: SourceDocument;
}

export interface SourceDocumentsState {
  sourceDocuments?: SourceDocuments; // null indicates the data has not yet loaded from the backend
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
  error: string | null;
}

export interface SourceContribution {
  name: string;
  identifier: string;
  source_type: string; // TODO
  external_link: string;
  description: string;
  qty_cards: string; // formatted by backend
  qty_cardbacks: string; // formatted by backend
  qty_tokens: string; // formatted by backend
  avgdpi: string; // formatted by backend
  size: string; // formatted by backend
}

export interface Contributions {
  sources: Array<SourceContribution>;
  card_count_by_type: { [card_type in CardType]: number };
  total_database_size: number;
}

export interface PatreonCampaign {
  id: string;
  about: string;
}

export interface PatreonSupporter {
  name: string;
  tier: string;
  date: string;
}

export interface PatreonSupporterTier {
  title: string;
  description: string;
  usd: number;
}

export interface PatreonInfo {
  url: string | null;
  members: Array<PatreonSupporter> | null;
  tiers: { [tierId: string]: PatreonSupporterTier } | null;
  campaign: PatreonCampaign | null;
}

export interface BackendInfo {
  name: string | null;
  description: string | null;
  email: string | null;
  reddit: string | null;
  discord: string | null;
  patreon: PatreonInfo;
}

export interface BackendState {
  url: string | null;
  // TODO: connection status stuff in here probably
}

export type SourceRow = FromSchema<typeof sourceRowSchema>;
export type SearchTypeSettings = FromSchema<typeof searchTypeSettingsSchema>;
export type FilterSettings = FromSchema<typeof filterSettingsSchema>;
export type SourceSettings = FromSchema<typeof sourceSettingsSchema>;
export type SearchSettings = FromSchema<typeof searchSettingsSchema>;

export interface ImportSite {
  name: string;
  url: string;
}

export interface SearchQuery {
  query: string | null;
  card_type: CardType; // TODO: rename this to `cardType` from `card_type`
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

export interface DFCPairs {
  [front: string]: string;
}

export interface ViewSettingsState {
  frontsVisible: boolean;
  sourcesVisible: { [source: string]: boolean };
  facetBySource: boolean;
}

export type ProcessedLine = [number, SearchQuery | null, SearchQuery | null];
