import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import { useAppDispatch } from "@/common/types";
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

export function ManageLocalFilesModal({
  show,
  handleClose,
}: ManageLocalFilesModalProps) {
  const [localFiles, setLocalFiles] = useLocalFilesContext();
  const dispatch = useAppDispatch();
  const projectName = useProjectName();

  const indexDirectory = (directory: File): void => {
    // TODO: decide how we should index files in directories
    //   consider using https://github.com/nextapps-de/flexsearch
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: `Synchronised ${directory.name}`,
          message: null, // TODO: indicate how many images were indexed
          level: "info",
        },
      ])
    );
  };

  const addDirectory = async () => {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      setLocalFiles([...localFiles, dirHandle]);
      indexDirectory(dirHandle);
    } catch {
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
              headers={["Directory", "Sync", "Remove"]}
              data={localFiles.map((item, i) => [
                <code key={`${i}-name`}>{item.name}</code>,
                <TableButton
                  key={`${i}-sync`}
                  onClick={() => indexDirectory(localFiles[i])}
                  className="bi bi-arrow-repeat"
                />,
                <TableButton
                  key={`${i}-remove`}
                  onClick={() => removeDirectory(i)}
                  className="bi bi-x-lg"
                />,
              ])}
              alignment={["left", "center", "center"]}
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
