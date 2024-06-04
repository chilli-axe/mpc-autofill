import Fuse from "fuse.js";
import { imageDimensionsFromData } from "image-dimensions";
import { filetypemime } from "magic-bytes.js";
import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import {
  CardDocument,
  CardType,
  DirectoryIndex,
  useAppDispatch,
} from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { AutofillTable } from "@/components/table";
import { useProjectName } from "@/features/backend/backendSlice";
import { useLocalFilesContext } from "@/features/localFiles/localFilesContext";
import { showModal } from "@/features/modals/modalsSlice";
import { setNotification } from "@/features/toasts/toastsSlice";

interface ManageLocalFilesModalProps {
  show: boolean;
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

const TableButton = styled.i`
  cursor: pointer;
`;

async function listAllFilesAndDirs(
  dirHandle: FileSystemDirectoryHandle
): Promise<Array<CardDocument>> {
  const files: Array<CardDocument> = [];
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
          ? "CARDBACK"
          : dirHandle.name.startsWith("Token")
          ? "TOKEN"
          : "CARD";
        const url = URL.createObjectURL(file);
        // TODO: when we reindex or remove directories, we need to release these: URL.revokeObjectURL(objectURL)

        const DPI_HEIGHT_RATIO = 300 / 1110;
        const dpi = 10 * Math.round((height * DPI_HEIGHT_RATIO) / 10);

        const cardDocument: CardDocument = {
          identifier: name, // TODO: how do we guarantee uniqueness across nested directories?
          card_type: cardType,
          name: name,
          priority: 0,
          date: file.lastModified.toString(), // TODO
          source: dirHandle.name,
          source_id: -1, // TODO: make this nullable
          source_name: dirHandle.name, // TODO: relative path
          source_verbose: dirHandle.name, // TODO: relative path
          source_external_link: null,
          dpi: dpi,
          searchq: name,
          extension: "", // TODO: just do the naive thing i suppose!
          download_link: "", // TODO: should be null
          size: size,
          small_thumbnail_url: url,
          medium_thumbnail_url: url,
          language: "English",
          tags: [],
        };
        files.push(cardDocument);
      }
    }
  }
  return files;
}

export function ManageLocalFilesModal({
  show,
  handleClose,
}: ManageLocalFilesModalProps) {
  const [localFiles, setLocalFiles] = useLocalFilesContext();
  const dispatch = useAppDispatch();
  const projectName = useProjectName();

  const indexDirectory = async (
    handle: FileSystemDirectoryHandle
  ): Promise<DirectoryIndex> => {
    const theMen = await listAllFilesAndDirs(handle);
    const fuseIndex = Fuse.createIndex<CardDocument>(["name"], theMen);
    const fuse = new Fuse<CardDocument>(theMen, {}, fuseIndex);
    const directoryIndex = {
      handle: handle,
      index: {
        fuse: fuse,
        size: theMen.length,
      },
    };
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: `Synchronised ${handle.name}`,
          message: `Indexed ${theMen.length} cards.`,
          level: "info",
        },
      ])
    );
    return directoryIndex;
  };

  const addDirectory = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      const directoryIndex = await indexDirectory(handle);
      setLocalFiles([...localFiles, directoryIndex]);
    } catch {
      // TODO: catch specific errors from `showDirectoryPicker`
      // RIP firefox :(
      dispatch(
        setNotification([
          Math.random().toString(),
          {
            name: "Opening Local Folders is Unsupported",
            message:
              "Your browser doesn't support opening local folders. Sorry about that!",
            level: "warning",
          },
        ])
      );
    }
  };

  const removeDirectory = (i: number): void => {
    setLocalFiles([...localFiles.slice(0, i), ...localFiles.slice(i + 1)]);
  };

  return (
    <Modal scrollable show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Manage Local Files</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Use this menu to set up the directories in your computer which your
          browser can read images from.
        </p>
        <p>
          Images in these directories can be added into your project and
          auto-filled into{" "}
          <a href={MakePlayingCardsURL} target="_blank">
            {MakePlayingCards}
          </a>{" "}
          without being indexed by {projectName}.
        </p>
        <Row className="g-0 pt-2">
          <Button variant="outline-success" onClick={addDirectory}>
            <RightPaddedIcon bootstrapIconName="plus-circle" />
            Add Directory
          </Button>
        </Row>

        {localFiles.length > 0 && (
          <>
            <br />
            <AutofillTable
              headers={["Directory", "Indexed Cards", "Sync", "Remove"]}
              data={localFiles.map((item, i) => [
                <code key={`${i}-name`}>{item.handle.name}</code>,
                item.index?.size,
                <TableButton
                  key={`${i}-sync`}
                  onClick={() => indexDirectory(localFiles[i].handle)}
                  className="bi bi-arrow-repeat"
                />,
                <TableButton
                  key={`${i}-remove`}
                  onClick={() => removeDirectory(i)}
                  className="bi bi-x-lg"
                />,
              ])}
              alignment={["left", "center", "center", "center"]}
              uniformWidth={false}
              bordered={true}
            />
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function ManageLocalFiles() {
  const dispatch = useAppDispatch();
  const handleClick = () => dispatch(showModal("manageLocalFiles"));

  return (
    <Button variant="outline-primary" onClick={handleClick}>
      <RightPaddedIcon bootstrapIconName="folder-symlink" />
      Manage Local Files
    </Button>
  );
}
