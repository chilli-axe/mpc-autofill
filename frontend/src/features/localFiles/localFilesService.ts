import { create, insertMultiple } from "@orama/orama";
import { imageSize } from "image-size";
import { filetypeextension, filetypemime } from "magic-bytes.js";

import { CardType as CardTypeSchema } from "@/common/schema_types";
import {
  CardType,
  DirectoryIndex,
  OramaCardDocument,
  OramaSchema,
} from "@/common/types";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

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
}

export const localFilesService = new LocalFilesService();
