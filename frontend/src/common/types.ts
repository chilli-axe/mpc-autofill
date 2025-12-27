import {
  asyncThunkCreator,
  buildCreateSlice,
  createAsyncThunk,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";

import { CSVHeaders } from "@/common/constants";
import {
  Card,
  CardType as CardTypeSchema,
  SearchQuery,
  Source,
} from "@/common/schema_types";
import type { AppDispatch, AppStore, RootState } from "@/store/store";
export type {
  Campaign,
  CardbacksRequest,
  Card as CardDocument,
  ErrorResponse,
  FilterSettings,
  ImportSite,
  ImportSiteDecklistRequest,
  Info,
  Language,
  NewCardsFirstPage,
  Patreon,
  SearchQuery,
  SearchSettings,
  SearchTypeSettings,
  SortBy,
  Source,
  SourceContribution,
  Source as SourceDocument,
  SourceSettings,
  Supporter,
  SupporterTier,
  Tag,
} from "@/common/schema_types";
import { Orama, Schema, SearchableType } from "@orama/orama";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
export const createAppSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});

export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: string;
}>();

export type ThunkStatus = "idle" | "loading" | "succeeded" | "failed";

export type CardType =
  | CardTypeSchema.Card
  | CardTypeSchema.Cardback
  | CardTypeSchema.Token;
export type Faces = "front" | "back";

export interface Notification {
  name: string | null;
  message: string | null;
  level: "info" | "warning" | "error";
}

export interface ThunkStateBase {
  status: ThunkStatus;
  error: Notification | null;
}

export interface CardDocuments {
  [key: string]: Card;
}

export interface CardDocumentsState extends ThunkStateBase {
  cardDocuments: CardDocuments;
}

export interface CardbacksState extends ThunkStateBase {
  cardbacks: Array<string>;
}

export interface SourceDocuments {
  [pk: number]: Source;
}

export interface SourceDocumentsState extends ThunkStateBase {
  sourceDocuments?: SourceDocuments; // null indicates the data has not yet loaded from the backend
}

export type SearchResultsForQuery = {
  [cardType in CardType]: Array<string>;
};

export interface SearchResults {
  [query: string]: SearchResultsForQuery;
}

export interface SearchResultsState extends ThunkStateBase {
  searchResults: SearchResults;
}

export interface BackendState {
  url: string | null;
  // TODO: connection status stuff in here probably
}

export interface ProjectMember {
  query: SearchQuery;
  selectedImage?: string;
  selected: boolean;
}

export type SlotProjectMembers = {
  [face in Faces]: ProjectMember | null;
};

export type Project = {
  members: Array<SlotProjectMembers>;
  cardback: string | null;
  mostRecentlySelectedSlot: Slot | null;
};

export interface DFCPairs {
  [front: string]: string;
}

export interface ViewSettingsState {
  frontsVisible: boolean;
  sourcesVisible: { [source: string]: boolean };
  facetBySource: boolean;
  jumpToVersionVisible: boolean;
}

export type Cardstock =
  | "(S27) Smooth"
  | "(S30) Standard Smooth"
  | "(S33) Superior Smooth"
  | "(M31) Linen"
  | "(P10) Plastic";

export interface FinishSettingsState {
  cardstock: Cardstock;
  foil: boolean;
}

export type FileDownloadStatus = "success" | "failed" | "terminated";
export type FileDownloadType = "image" | "xml" | "text";

export interface FileDownload {
  name: string;
  type: FileDownloadType;
  enqueuedTimestamp: string; // can't store dates in redux y'see
  startedTimestamp?: string; // can't store dates in redux y'see
  completedTimestamp?: string; // can't store dates in redux y'see
  status?: FileDownloadStatus;
}

export interface EnqueueFileDownload
  extends Omit<FileDownload, "completedTimestamp" | "status"> {
  id: string;
}

export interface FileDownloadsState {
  [id: string]: FileDownload;
}

export type ProcessedLine = [
  number,
  ProjectMember | null,
  ProjectMember | null
];

export interface ToastsState {
  notifications: { [key: string]: Notification };
}

export type Slot = [Faces, number];
export type Slots = Array<Slot>;

export type Modals =
  | "cardDetailedView"
  | "gridSelector"
  | "changeQuery"
  | "supportDeveloper"
  | "supportBackend"
  | "invalidIdentifiers"
  | "finishedMyProject"
  | "manageLocalFiles";

export type NoPropModals = Exclude<
  Modals,
  "cardDetailedView" | "gridSelector" | "changeQuery"
>;

export interface CardDetailedViewModalState {
  card: Card;
}

export interface ChangeQueryModalState {
  query: string | null;
  slots: Slots;
}

export type ModalsState = {
  shownModal: Modals | null;
  props:
    | { cardDetailedView: CardDetailedViewModalState }
    | { gridSelector: null } // TODO
    | { changeQuery: ChangeQueryModalState }
    | null;
};

export interface InvalidIdentifiersState {
  invalidIdentifiers: Array<{ [face in Faces]: [SearchQuery, string] | null }>;
}

export type CSVRow = {
  [column in CSVHeaders]?: string;
};

export type SourceRow = [number, boolean];

export const OramaSchema = {
  id: "string" as SearchableType,
  name: "string" as SearchableType,
  cardType: "string", // TODO: enum
  // date_created: "string",  // TODO: :(
  // date_modified: "string",  // TODO: :(
  extension: "string",
  url: "string",
  language: "string",
  tags: "enum[]", // enum allows using "not contained in" filters
  dpi: "number",
  size: "number",
} as Schema<OramaCardDocument>;

export type OramaCardDocument = Pick<
  Card,
  | "name"
  | "source"
  | "cardType"
  | "extension"
  | "language"
  | "tags"
  | "dpi"
  | "size"
> & { id: string; url: string };

export interface DirectoryIndex {
  handle: FileSystemDirectoryHandle;
  index:
    | {
        oramaDb: Orama<OramaCardDocument>;
        size: number; // TODO: really necessary?
      }
    | undefined;
}
