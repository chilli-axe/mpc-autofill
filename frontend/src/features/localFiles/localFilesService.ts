import { create, insertMultiple } from "@orama/orama";
import { search } from "@orama/orama";
import { imageSize } from "image-size";
import { filetypeextension, filetypemime } from "magic-bytes.js";

import {
  CardType as CardTypeSchema,
  SearchQuery,
  SearchSettings,
} from "@/common/schema_types";
import {
  CardType,
  DirectoryIndex,
  OramaCardDocument,
  OramaSchema,
  SearchResults,
} from "@/common/types";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

const getOramaCardDocument = async (
  file: File,
  dirHandle: FileSystemDirectoryHandle
): Promise<OramaCardDocument | null> => {
  const size = file.size;
  const data = new Uint8Array(await file.arrayBuffer());
  const fileType = filetypemime(data);
  const isImage = fileType.some((mimeType) => mimeType.startsWith("image/"));
  if (isImage) {
    const dimensions = imageSize(data);
    const height = dimensions.height ?? 0;
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
      id: file.name, // TODO: include full file path in id! this should flow through to generated XMLs.
      cardType: cardType,
      name: file.name,
      source: dirHandle.name,
      dpi: dpi,
      extension: filetypeextension(data)[0],
      size: size,
      url: url,
      language: "English",
      tags: [],
    };
    return oramaCardDocument;
  } else {
    return null;
  }
};

async function listAllFilesAndDirs(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<OramaCardDocument>> {
  const files: Array<OramaCardDocument> = [];
  for await (const [name, handle] of dirHandle) {
    if (handle instanceof FileSystemDirectoryHandle) {
      files.push(...(await listAllFilesAndDirs(handle)));
    } else if (handle instanceof FileSystemFileHandle) {
      const file = await handle.getFile();
      const oramaCardDocument = await getOramaCardDocument(file, dirHandle);
      if (oramaCardDocument !== null) {
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
  const newDirectoryIndex = {
    handle: handle,
    index: {
      oramaDb: db,
      size: oramaCardDocuments.length,
    },
  };
  dispatch(
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

export class LocalFilesService {
  directoryHandle: FileSystemDirectoryHandle | undefined;
  directoryIndex: DirectoryIndex | undefined;

  constructor() {
    this.directoryHandle = undefined;
    this.directoryIndex = undefined;
  }

  getDirectoryHandle(): FileSystemDirectoryHandle | undefined {
    return this.directoryHandle;
  }

  setDirectoryHandle(directoryHandle: FileSystemDirectoryHandle | undefined) {
    this.directoryHandle = directoryHandle;
  }

  async indexDirectory(dispatch: AppDispatch) {
    if (this.directoryHandle !== undefined) {
      this.directoryIndex = await indexDirectory(
        this.directoryHandle,
        dispatch
      );
    }
  }

  getDirectoryIndex(): DirectoryIndex | undefined {
    return this.directoryIndex;
  }

  search(
    searchSettings: SearchSettings,
    query: string | undefined,
    cardTypes: Array<CardType>
  ): Array<string> | undefined {
    if (this.directoryIndex?.index?.oramaDb === undefined) {
      return undefined;
    }
    const includesTags = searchSettings.filterSettings.includesTags.length > 0;
    // const excludesTags = searchSettings.filterSettings.includesTags.length > 0;
    const hits = search(this.directoryIndex?.index?.oramaDb, {
      term: query,
      properties: ["name"],
      exact: !searchSettings.searchTypeSettings.fuzzySearch,
      where: {
        cardType: {
          in: cardTypes,
        },
        ...(includesTags
          ? {
              tags: {
                containsAny: searchSettings.filterSettings.includesTags,
                // ...(excludesTags ? {nin: searchSettings.filterSettings.excludesTags} : {}),
              },
            }
          : {}),
        dpi: {
          between: [
            searchSettings.filterSettings.minimumDPI,
            searchSettings.filterSettings.maximumDPI,
          ],
        },
        // size: {
        //   lte: searchSettings.filterSettings.maximumSize
        // }
      },
    }).hits as Array<OramaCardDocument>;
    return hits.map((cardDocument) => cardDocument.id);
  }

  searchBig(
    searchSettings: SearchSettings,
    searchQueries: Array<SearchQuery>
  ): SearchResults {
    const localResults: SearchResults = {};
    for (const searchQuery of searchQueries) {
      if (searchQuery.query) {
        if (
          !Object.prototype.hasOwnProperty.call(localResults, searchQuery.query)
        ) {
          localResults[searchQuery.query] = {
            CARD: [],
            CARDBACK: [],
            TOKEN: [],
          };
        }

        const localResultsForQuery = localFilesService.search(
          searchSettings,
          searchQuery.query,
          [searchQuery.cardType]
        );
        if (localResultsForQuery !== undefined) {
          localResults[searchQuery.query][searchQuery.cardType] =
            localResultsForQuery;
        }
      }
    }
    return localResults;
  }
}

export const localFilesService = new LocalFilesService();
