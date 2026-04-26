import {
  asyncThunkCreator,
  buildCreateSlice,
  createAsyncThunk,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";

import { CSVHeaders } from "@/common/constants";
import {
  Card as CardSchema,
  CardType as CardTypeSchema,
  SearchQuery,
  Source,
  SourceType,
} from "@/common/schema_types";
import type { AppDispatch, AppStore, RootState } from "@/store/store";
export type {
  Campaign,
  CardbacksRequest,
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

export const assertNever = (value: never) => {
  throw new Error("Unexpected value: " + value);
};

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

export type Card = Omit<
  CardSchema,
  "smallThumbnailUrl" | "mediumThumbnailUrl"
> & {
  smallThumbnailUrl: string | undefined;
  mediumThumbnailUrl: string | undefined;
};
export type CardDocument = Card;

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
  [cardType in CardType]?: Array<string>;
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

export type FacetBy = "Source" | "Printing" | "None";

export interface ViewSettingsState {
  frontsVisible: boolean;
  facetBy: FacetBy;
  facetsVisible: { [facetKey: string]: boolean };
  compressed: boolean;
  jumpToVersionVisible: boolean;
  viewVisible: boolean;
  sortVisible: boolean;
  filterVisible: boolean;
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
export type FileDownloadType =
  | "image"
  | "xml"
  | "text"
  | "pdf"
  | "desktop-tool";

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
  | "PDFGenerator";

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
  searchq: "string" as SearchableType,
  sourceId: "number" as SearchableType,
  lastModifiedNumber: "number" as SearchableType,
  createdNumber: "number" as SearchableType,
  cardType: "enum",
  extension: "enum",
  language: "enum",
  tags: "enum[]", // enum allows using "not contained in" filters
  dpi: "number",
  size: "number",
  expansionCode: "string",
  collectorNumber: "string",
  artist: "enum",
} as const;

export type LocalFileHandleParams = {
  sourceType: SourceType.LocalFile;
  identifier: undefined;
  fileHandle: FileSystemFileHandle;
};

export type LocalDirectoryHandleParams = {
  sourceType: SourceType.LocalFile;
  identifier: undefined;
  fileHandle: FileSystemDirectoryHandle;
};

export type RemoteFileHandleParams = {
  sourceType: SourceType.GoogleDrive | SourceType.AwsS3;
  identifier: string;
  fileHandle: undefined;
};

export type FileHandleParams = LocalFileHandleParams | RemoteFileHandleParams;

export type OramaCardDocument = Pick<
  Card,
  | "name"
  | "searchq"
  | "source"
  | "sourceId"
  | "sourceVerbose"
  | "cardType"
  | "extension"
  | "language"
  | "tags"
  | "dpi"
  | "size"
> & {
  id: string;
  lastModified: Date;
  lastModifiedNumber: number;
  created: Date;
  createdNumber: number;
  expansionCode: string;
  collectorNumber: string;
  artist: string;
} & {
  params: FileHandleParams;
};

export interface OramaIndex {
  oramaDb: Orama<typeof OramaSchema>;
  size: number;
}

export interface LocalFilesIndex {
  fileHandle: FileSystemDirectoryHandle;
  index: OramaIndex | undefined;
}

export interface GoogleDriveIndex {
  index: OramaIndex | undefined;
}

/**
 * google drive-picker-element returns an array of these after picking files & folders
 */
export interface GoogleDriveDoc {
  id: string;
  serviceId: string;
  mimeType: string;
  name: string;
  description: string;
  type: string;
  lastEditedUtc: number;
  iconUrl: string;
  url: string;
  embedUrl: string;
  driveSuccess: boolean;
  driveError: string;
  sizeBytes: number;
  parentId: string;
  isShared: boolean;
}

// https://developers.google.com/workspace/drive/api/reference/rest/v3/files
export interface GoogleDriveUser {
  displayName: string;
  kind: string;
  me: boolean;
  permissionId: string;
  emailAddress: string;
  photoLink: string;
}

export interface GoogleDriveContentRestriction {
  readOnly: boolean;
  reason: string;
  type: string;
  restrictingUser: GoogleDriveUser;
  restrictionTime: string;
  ownerRestricted: boolean;
  systemRestricted: boolean;
}

export interface GoogleDrivePermission {
  permissionDetails: Array<{
    permissionType: string;
    inheritedFrom: string;
    role: string;
    inherited: boolean;
  }>;
  teamDrivePermissionDetails: Array<{
    teamDrivePermissionType: string;
    inheritedFrom: string;
    role: string;
    inherited: boolean;
  }>;
  id: string;
  displayName: string;
  type: string;
  kind: string;
  photoLink: string;
  emailAddress: string;
  role: string;
  allowFileDiscovery: boolean;
  domain: string;
  expirationTime: string;
  deleted: boolean;
  view: string;
  pendingOwner: boolean;
  inheritedPermissionsDisabled: boolean;
}

export interface GoogleDriveField {
  dateString: Array<string>;
  integer: Array<string>;
  selection: Array<string>;
  text: Array<string>;
  user: Array<GoogleDriveUser>;
  kind: string;
  id: string;
  valueType: string;
}

export interface GoogleDriveLabel {
  fields: {
    [fieldName: string]: GoogleDriveField;
  };
  id: string;
  revisionId: string;
  kind: string;
}

export interface GoogleDriveDownloadRestriction {
  restrictedForReaders: boolean;
  restrictedForWriters: boolean;
}

export interface GoogleDriveDownloadRestrictionsMetadata {
  itemDownloadRestriction: GoogleDriveDownloadRestriction;
  effectiveDownloadRestrictionWithContext: GoogleDriveDownloadRestriction;
}

export interface GoogleDriveFile {
  exportLinks: Record<string, string>;
  parents: string[];
  owners: GoogleDriveUser[];
  permissions: GoogleDrivePermission[];
  spaces: string[];
  properties: Record<string, unknown>;
  appProperties: Record<string, unknown>;
  permissionIds: string[];
  contentRestrictions: GoogleDriveContentRestriction[];
  kind: string;
  driveId: string;
  fileExtension: string;
  copyRequiresWriterPermission: boolean;
  md5Checksum: string;
  contentHints: {
    indexableText: string;
    thumbnail: {
      image: string;
      mimeType: string;
    };
  };
  writersCanShare: boolean;
  viewedByMe: boolean;
  mimeType: string;
  thumbnailLink: string;
  iconLink: string;
  shared: boolean;
  lastModifyingUser: GoogleDriveUser;
  headRevisionId: string;
  sharingUser: GoogleDriveUser;
  webViewLink: string;
  webContentLink: string;
  size: string;
  viewersCanCopyContent: boolean;
  hasThumbnail: boolean;
  folderColorRgb: string;
  id: string;
  name: string;
  description: string;
  starred: boolean;
  trashed: boolean;
  explicitlyTrashed: boolean;
  createdTime: string;
  modifiedTime: string;
  modifiedByMeTime: string;
  viewedByMeTime: string;
  sharedWithMeTime: string;
  quotaBytesUsed: string;
  version: string;
  originalFilename: string;
  ownedByMe: boolean;
  fullFileExtension: string;
  isAppAuthorized: boolean;
  teamDriveId: string;
  capabilities: {
    canChangeViewersCanCopyContent: boolean;
    canMoveChildrenOutOfDrive: boolean;
    canReadDrive: boolean;
    canEdit: boolean;
    canCopy: boolean;
    canComment: boolean;
    canAddChildren: boolean;
    canDelete: boolean;
    canDownload: boolean;
    canListChildren: boolean;
    canRemoveChildren: boolean;
    canRename: boolean;
    canTrash: boolean;
    canReadRevisions: boolean;
    canReadTeamDrive: boolean;
    canMoveTeamDriveItem: boolean;
    canChangeCopyRequiresWriterPermission: boolean;
    canMoveItemIntoTeamDrive: boolean;
    canUntrash: boolean;
    canModifyContent: boolean;
    canMoveItemWithinTeamDrive: boolean;
    canMoveItemOutOfTeamDrive: boolean;
    canDeleteChildren: boolean;
    canMoveChildrenOutOfTeamDrive: boolean;
    canMoveChildrenWithinTeamDrive: boolean;
    canTrashChildren: boolean;
    canMoveItemOutOfDrive: boolean;
    canAddMyDriveParent: boolean;
    canRemoveMyDriveParent: boolean;
    canMoveItemWithinDrive: boolean;
    canShare: boolean;
    canMoveChildrenWithinDrive: boolean;
    canModifyContentRestriction: boolean;
    canAddFolderFromAnotherDrive: boolean;
    canChangeSecurityUpdateEnabled: boolean;
    canAcceptOwnership: boolean;
    canReadLabels: boolean;
    canModifyLabels: boolean;
    canModifyEditorContentRestriction: boolean;
    canModifyOwnerContentRestriction: boolean;
    canRemoveContentRestriction: boolean;
    canDisableInheritedPermissions: boolean;
    canEnableInheritedPermissions: boolean;
    canChangeItemDownloadRestriction: boolean;
  };
  hasAugmentedPermissions: boolean;
  trashingUser: GoogleDriveUser;
  thumbnailVersion: string;
  trashedTime: string;
  modifiedByMe: boolean;
  imageMediaMetadata: {
    flashUsed: boolean;
    meteringMode: string;
    sensor: string;
    exposureMode: string;
    colorSpace: string;
    whiteBalance: string;
    width: number;
    height: number;
    location: {
      latitude: number;
      longitude: number;
      altitude: number;
    };
    rotation: number;
    time: string;
    cameraMake: string;
    cameraModel: string;
    exposureTime: number;
    aperture: number;
    focalLength: number;
    isoSpeed: number;
    exposureBias: number;
    maxApertureValue: number;
    subjectDistance: number;
    lens: string;
  };
  videoMediaMetadata: {
    width: number;
    height: number;
    durationMillis: string;
  };
  shortcutDetails: {
    targetId: string;
    targetMimeType: string;
    targetResourceKey: string;
  };
  resourceKey: string;
  linkShareMetadata: {
    securityUpdateEligible: boolean;
    securityUpdateEnabled: boolean;
  };
  labelInfo: {
    labels: Array<GoogleDriveLabel>;
  };
  sha1Checksum: string;
  sha256Checksum: string;
  inheritedPermissionsDisabled: boolean;
  downloadRestrictions: GoogleDriveDownloadRestrictionsMetadata;
}

export const GoogleDriveImageMimeTypes = [
  "image/png",
  "image/jpg",
  "image/jpeg",
];

export type OramaSearchResult = { id: string; document: OramaCardDocument };
export type OramaSearchResults = {
  hits: Array<OramaSearchResult>;
  count: number;
};

export type BackendType = "local" | "remote";
