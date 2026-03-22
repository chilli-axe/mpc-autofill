import React, { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import { useAppDispatch, useAppStore } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import {
  useLocalFilesDirectoryHandle,
  useLocalFilesDirectoryIndexSize,
} from "@/features/clientSearch/clientSearchHooks";
import { useGoogleDrivePickerContext } from "@/features/googleDrive/googleDrivePickerContext";
import { useGetTagsQuery } from "@/store/api";
import { setNotification } from "@/store/slices/toastsSlice";

interface GoogleDriveBackendConfigProps {
  handleClose: {
    (): void;
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void;
  };
}

export const GoogleDriveBackendConfig = ({
  handleClose,
}: GoogleDriveBackendConfigProps) => {
  const { clientSearchService, forceUpdate } = useClientSearchContext();
  const directoryHandle = useLocalFilesDirectoryHandle();
  const directoryIndexSize = useLocalFilesDirectoryIndexSize();
  const getTagsQuery = useGetTagsQuery();
  const { setShow } = useGoogleDrivePickerContext();

  const dispatch = useAppDispatch();
  const store = useAppStore();

  const chooseDirectory = async () => {
    setShow(true);
    handleClose();
  };

  return (
    <>
      <h4>Google Drive</h4>
      {directoryHandle !== undefined && (
        <Alert variant="success">
          You&apos;re connected to <b>{directoryHandle.name}</b>, with{" "}
          <b>{directoryIndexSize ?? 0}</b> images indexed.
          <Row className="gx-1 pt-2">
            <Col xs={6}>
              <div className="d-grid gap-0">
                <Button
                  variant="primary"
                  onClick={async () =>
                    clientSearchService.indexDirectory(
                      dispatch,
                      forceUpdate,
                      getTagsQuery.data
                    )
                  }
                >
                  <RightPaddedIcon bootstrapIconName="arrow-repeat" />
                  Synchronise
                </Button>
              </div>
            </Col>
            {/* <Col xs={6}>
              <div className="d-grid gap-0">
                <Button variant="danger" onClick={clearDirectoryChoice}>
                  <RightPaddedIcon bootstrapIconName="eject" />
                  Disconnect
                </Button>
              </div>
            </Col> */}
          </Row>
        </Alert>
      )}
      <p>
        Choose Google Drive files and folder you&apos;d like to connect{" "}
        {ProjectName} to.
      </p>
      <Row className="g-0">
        <Button variant="outline-primary" onClick={chooseDirectory}>
          <RightPaddedIcon bootstrapIconName="plus-circle" />
          Choose Resources
        </Button>
      </Row>
    </>
  );
};
