import styled from "@emotion/styled";
import React from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";

import { MakePlayingCards, MakePlayingCardsURL } from "@/common/constants";
import { useAppDispatch } from "@/common/types";
import { AutofillTable } from "@/components/AutofillTable";
import { RightPaddedIcon } from "@/components/icon";
import { useProjectName } from "@/store/slices/backendSlice";
import { showModal } from "@/store/slices/modalsSlice";
import { setNotification } from "@/store/slices/toastsSlice";

import { useLocalFilesContext } from "./localFilesContext";

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
  const localFilesService = useLocalFilesContext();

  const dispatch = useAppDispatch();
  const projectName = useProjectName();

  const chooseDirectory = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      localFilesService.setDirectoryHandle(handle);
      await localFilesService.indexDirectory(dispatch);
      // dispatch(setDirectoryHandle(handle));
    } catch (e) {
      // TODO: catch specific errors from `showDirectoryPicker`
      // RIP firefox :(
      console.log(e);
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
          <Button variant="outline-success" onClick={chooseDirectory}>
            <RightPaddedIcon bootstrapIconName="plus-circle" />
            Choose Directory
          </Button>
        </Row>

        {localFilesService.getDirectoryHandle() !== undefined && (
          <>
            <br />
            <AutofillTable
              headers={["Directory", "Indexed Cards", "Remove"]}
              data={[
                [
                  <code key={"silly1"}>
                    {localFilesService.getDirectoryHandle()!.name}
                  </code>,
                  0,
                  <TableButton key="" className="bi bi-x-lg" />,
                  // directoryIndex.index?.size,
                  // <TableButton
                  //   key={"silly2"}
                  //   onClick={() => clearDirectoryChoice()}
                  //   className="bi bi-x-lg"
                  // />,
                ],
              ]}
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
