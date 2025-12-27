/**
 * State management for cards retrieved from the backend.
 */

import { create, getByID, insertMultiple, Orama } from "@orama/orama";
import { createSelector } from "@reduxjs/toolkit";
import { imageDimensionsFromData } from "image-dimensions";
import { filetypeextension, filetypemime } from "magic-bytes.js";

import { CardEndpointPageSize } from "@/common/constants";
import {
  CardType as CardTypeSchema,
  SearchSettings,
  SourceType,
} from "@/common/schema_types";
import {
  CardDocument,
  CardDocumentsState,
  CardType,
  createAppAsyncThunk,
  createAppSlice,
  DirectoryIndex,
  OramaCardDocument,
  OramaSchema,
  useAppSelector,
} from "@/common/types";
import { CardDocuments } from "@/common/types";
import { APIGetCards } from "@/store/api";
import { fetchCardbacksAndReportError } from "@/store/slices/cardbackSlice";
import {
  selectProjectMemberIdentifiers,
  selectUniqueCardIdentifiers,
} from "@/store/slices/projectSlice";
import { fetchSearchResultsAndReportError } from "@/store/slices/searchResultsSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch, RootState } from "@/store/store";

//# region async thunk

const typePrefix = "cardDocuments/fetchCardDocuments";

export const getCardDocumentRequestPromiseChain = async (
  identifiersToSearch: Array<string>,
  backendURL: string | null
): Promise<CardDocuments> => {
  if (identifiersToSearch.length > 0 && backendURL != null) {
    // this block of code looks a bit arcane.
    // we're dynamically constructing a promise chain according to the number of requests we need to make
    // to retrieve all database rows corresponding to `identifiersToSearch`.
    // e.g. say that `identifiersToSearch` contains 1500 identifiers.
    // two requests will be issued, the first for 1000 cards, and the second for 500 cards
    // (with the second request only commencing once the first has finished).
    return Array.from(
      Array(Math.ceil(identifiersToSearch.length / CardEndpointPageSize)).keys()
    ).reduce(function (promiseChain: Promise<CardDocuments>, page: number) {
      return promiseChain.then(async function (previousValue: CardDocuments) {
        const cards = await APIGetCards(
          backendURL,
          identifiersToSearch.slice(
            page * CardEndpointPageSize,
            (page + 1) * CardEndpointPageSize
          )
        );
        return { ...previousValue, ...cards };
      });
    }, Promise.resolve({}));
  } else {
    return {};
  }
};

async function listAllFilesAndDirs(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<OramaCardDocument>> {
  const files: Array<OramaCardDocument> = [];
  // @ts-ignore  // TODO: is this a problem with my typescript target?
  for await (let [name, handle] of dirHandle) {
    if (handle.kind === "directory") {
      files.push(...(await listAllFilesAndDirs(handle)));
    } else {
      const file: File = await handle.getFile();
      const size = file.size;
      const data = new Uint8Array(await file.arrayBuffer());
      const fileType = filetypemime(data);
      const isImage = fileType.some((mimeType) =>
        mimeType.startsWith("image/")
      );
      if (isImage) {
        const dimensions = imageDimensionsFromData(data);
        const height = dimensions?.height ?? 0;
        const cardType: CardType = dirHandle.name.startsWith("Cardback")
          ? CardTypeSchema.Cardback
          : dirHandle.name.startsWith("Token")
          ? CardTypeSchema.Token
          : CardTypeSchema.Card;
        // TODO: can we store file handles on `CardDocument`, then tie our URL lifecycles to image showing?
        const url = URL.createObjectURL(file);
        // TODO: when we reindex or remove directories, we need to release these: URL.revokeObjectURL(objectURL)

        const DPI_HEIGHT_RATIO = 300 / 1110;
        const dpi = 10 * Math.round((height * DPI_HEIGHT_RATIO) / 10);

        const oramaCardDocument: OramaCardDocument = {
          id: name, // TODO: include full file path in id! this should flow through to generated XMLs.
          cardType: cardType,
          name: name,
          // dateCreated: new Date(file.lastModified).toLocaleDateString(), // TODO
          // dateModified: new Date(file.lastModified).toLocaleDateString(),
          source: dirHandle.name,
          dpi: dpi,
          extension: filetypeextension(data)[0],
          size: size,
          url: url,
          language: "English",
          tags: [],
        };
        files.push(oramaCardDocument);
      }
    }
  }
  return files;
}

const indexDirectory = async (
  handle: FileSystemDirectoryHandle,
  dispatch: AppDispatch
): Promise<DirectoryIndex> => {
  const db = create({
    schema: OramaSchema,
  });
  const oramaCardDocuments = await listAllFilesAndDirs(handle);
  insertMultiple(db, oramaCardDocuments);
  // const fuseIndex = Fuse.createIndex<CardDocument>(["name"], cardDocuments);
  // const fuse = new Fuse<CardDocument>(cardDocuments, {}, fuseIndex);
  const newDirectoryIndex = {
    handle: handle,
    index: {
      oramaDb: db,
      size: oramaCardDocuments.length,
    },
  };
  dispatch(
    // TODO: do we want this notification?
    setNotification([
      Math.random().toString(),
      {
        name: `Synchronised ${handle.name}`,
        message: `Indexed ${oramaCardDocuments.length} cards.`,
        level: "info",
      },
    ])
  );
  // @ts-ignore // TODO: fix properly.
  return newDirectoryIndex; // @ts-ignore TODO: can we serialise/deserialise our index as it's needed to improve performance?
};

const getLocalCardDocuments = (
  oramaDb: Orama<OramaCardDocument>,
  identifiersToSearch: Array<string>
): CardDocuments => {
  return Object.fromEntries(
    identifiersToSearch.reduce(
      (accumulated: Array<[string, CardDocument]>, identifier: string) => {
        const oramaCardDocument = getByID(oramaDb, identifier) as
          | OramaCardDocument
          | undefined;
        if (oramaCardDocument !== undefined) {
          accumulated.push([
            oramaCardDocument.id,
            {
              identifier: oramaCardDocument.id,
              cardType: oramaCardDocument.cardType,
              name: oramaCardDocument.name,
              priority: 0,
              source: oramaCardDocument.source,
              sourceName: oramaCardDocument.source,
              sourceId: 0,
              sourceVerbose: oramaCardDocument.source,
              sourceType: SourceType.LocalFile,
              sourceExternalLink: undefined,
              dpi: oramaCardDocument.dpi,
              searchq: oramaCardDocument.name,
              extension: oramaCardDocument.extension,
              dateCreated: "1st January, 2000", // TODO
              dateModified: "1st January, 2000", // TODO
              size: oramaCardDocument.size,
              smallThumbnailUrl: oramaCardDocument.url,
              mediumThumbnailUrl: oramaCardDocument.url,
              language: "EN", // TODO
              tags: oramaCardDocument.tags,
            },
          ]);
        }
        return accumulated;
      },
      [] as Array<[string, CardDocument]>
    )
  );
};

const fetchCardDocuments = createAppAsyncThunk(
  typePrefix,
  /**
   * This function queries card documents (entire database rows) from the backend. It only queries cards which have
   * not yet been queried.
   */
  async (arg, { dispatch, getState }) => {
    const directoryHandle = getState().searchResults.directoryHandle;
    const oramaDb =
      directoryHandle !== undefined
        ? (await indexDirectory(directoryHandle, dispatch)).index?.oramaDb
        : undefined;
    await fetchSearchResultsAndReportError(dispatch, oramaDb);
    if (getState().cardbacks.cardbacks.length === 0) {
      await fetchCardbacksAndReportError(dispatch);
    }

    const state = getState() as RootState;

    const allIdentifiers = selectUniqueCardIdentifiers(state);
    const identifiersWithKnownData = new Set(
      Object.keys(state.cardDocuments.cardDocuments)
    );
    const identifiersToSearch = Array.from(
      new Set(
        Array.from(allIdentifiers).filter(
          (item) => !identifiersWithKnownData.has(item)
        )
      )
    );

    const backendURL = state.backend.url;
    const remoteCardDocuments = await getCardDocumentRequestPromiseChain(
      identifiersToSearch,
      backendURL
    );
    if (oramaDb) {
      const localCardDocuments = getLocalCardDocuments(
        oramaDb,
        identifiersToSearch
      ); // TODO: passing `identifiersToSearch` feels wrong here.
      return { ...localCardDocuments, ...remoteCardDocuments };
    }
    return remoteCardDocuments;
  }
);

export async function fetchCardDocumentsAndReportError(dispatch: AppDispatch) {
  try {
    await dispatch(fetchCardDocuments()).unwrap();
  } catch (error: any) {
    dispatch(
      setNotification([
        typePrefix,
        { name: error.name, message: error.message, level: "error" },
      ])
    );
    return null;
  }
}

//# endregion

//# region slice configuration

const initialState: CardDocumentsState = {
  cardDocuments: {},
  status: "idle",
  error: null,
};

export const cardDocumentsSlice = createAppSlice({
  name: "cardDocuments",
  initialState,
  reducers: {
    addCardDocuments: (state, action) => {
      state.cardDocuments = { ...state.cardDocuments, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCardDocuments.pending, (state, action) => {
        state.status = "loading";
      })
      .addCase(fetchCardDocuments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.cardDocuments = { ...state.cardDocuments, ...action.payload };
      })
      .addCase(fetchCardDocuments.rejected, (state, action) => {
        state.status = "failed";
        state.error = {
          name: action.error.name ?? null,
          message: action.error.message ?? null,
          level: "error",
        };
      });
  },
});

export const { addCardDocuments } = cardDocumentsSlice.actions;
export default cardDocumentsSlice.reducer;

//# endregion

//# region selectors

export const selectCardDocumentByIdentifier = createSelector(
  (state: RootState, imageIdentifier: string | undefined) => imageIdentifier,
  (state: RootState, imageIdentifier: string | undefined) =>
    state.cardDocuments.cardDocuments,
  (imageIdentifier, cardDocuments) =>
    imageIdentifier != null ? cardDocuments[imageIdentifier] : undefined
);

export const selectCardDocumentsByIdentifiers = createSelector(
  (state: RootState, identifiers: Array<string>) => identifiers,
  (state: RootState, identifiers: Array<string>) =>
    state.cardDocuments.cardDocuments,
  (identifiers, cardDocuments) =>
    Object.fromEntries(
      identifiers.map((identifier) => [identifier, cardDocuments[identifier]])
    )
);

export const getCardSizesByIdentifier = (
  identifiers: Array<string>,
  cardDocuments: CardDocuments
) =>
  Object.fromEntries(
    identifiers.map((identifier) => [
      identifier,
      cardDocuments[identifier]?.size ?? 0,
    ])
  );

export const selectCardSizesByIdentifier = createSelector(
  (state: RootState, identifiers: Array<string>) => identifiers,
  (state: RootState, identifiers: Array<string>) =>
    state.cardDocuments.cardDocuments,
  getCardSizesByIdentifier
);

//# endregion

//# region hooks

export function useCardDocumentsByIdentifier(): {
  [identifier: string]: CardDocument;
} {
  const identifiers = Array.from(
    useAppSelector(selectProjectMemberIdentifiers)
  );
  return useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, identifiers)
  );
}

//# endregion
