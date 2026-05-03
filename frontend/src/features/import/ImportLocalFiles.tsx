import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Modal from "react-bootstrap/Modal";
import { TreeData } from "react-dropdown-tree-select";

import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { RightPaddedIcon } from "@/components/icon";
import { Jumbotron } from "@/components/Jumbotron";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import { useLocalBackendConfigured } from "@/store/slices/backendSlice";

import { LocalFolderBackendConfig } from "../backend/LocalFolderBackendConfig";

interface ImportLocalFilesProps {
  onImportComplete?: () => void;
}

export function ImportLocalFiles({ onImportComplete }: ImportLocalFilesProps) {
  const localFilesBackendConfigured = useLocalBackendConfigured();
  const { clientSearchService } = useClientSearchContext();
  const [localFilesData, setLocalFilesData] = useState<TreeData>({});

  useEffect(() => {
    clientSearchService.getLocalFilesImages().then((images) => {
      if (images !== undefined && images.length > 0) {
        setLocalFilesData(
          images.map((image) => ({
            label: image.name,
            value: image.name, // TODO: probs need image ID here. stuff-around with tags, etc.
            actions: [
              // TODO: figure out what to do here re: controlling quantity
              // {
              //   className: "bi bi-check-circle-fill",
              //   title: "plus one"
              // }
            ],
          }))
        );
      } else {
        setLocalFilesData([]);
      }
    });
  }, [localFilesBackendConfigured]);
  return (
    <>
      <Jumbotron variant="dark">
        <LocalFolderBackendConfig />
        {localFilesBackendConfigured && (
          <>
            <br />
            <StyledDropdownTreeSelect
              data={localFilesData}
              onAction={(currentNode, currentAction) => {
                console.log("currentNode: ", currentNode);
                console.log("currentAction: ", currentAction);
              }}
            />
          </>
        )}
      </Jumbotron>
    </>
  );
}

export function ImportLocalFilesButton() {
  const [show, setShow] = useState<boolean>(false);

  return (
    <>
      <Dropdown.Item onClick={() => setShow(true)}>
        <RightPaddedIcon bootstrapIconName="upload" /> Local Files
      </Dropdown.Item>
      <Modal
        scrollable
        show={show}
        onHide={() => setShow(false)}
        data-testid="import-local-files"
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Cards — Local Files</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ImportLocalFiles onImportComplete={() => setShow(false)} />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            aria-label="import-text-close"
            onClick={() => setShow(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
