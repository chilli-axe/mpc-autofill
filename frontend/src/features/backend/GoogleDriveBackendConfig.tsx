import React, { useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import { GoogleDriveDoc, useAppDispatch, useAppStore } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import {
  BackendConfigStep,
  BackendConfigSteps,
  evaluateSteps,
  ValidationState,
} from "@/features/backend/BackendConfigSteps";
import { useClientSearchContext } from "@/features/clientSearch/clientSearchContext";
import {
  useGoogleDriveIndexSize,
  useHasGoogleDriveIndex,
} from "@/features/clientSearch/clientSearchHooks";
import {
  GoogleDrivePicker,
  PickerDoneResult,
} from "@/features/googleDrive/GoogleDrivePicker";
import { useGetTagsQuery } from "@/store/api";
import { setNotification } from "@/store/slices/toastsSlice";

export const GoogleDriveBackendConfig = () => {
  const { clientSearchService, forceUpdate } = useClientSearchContext();
  const hasGoogleDriveIndex = useHasGoogleDriveIndex();
  const googleDriveIndexSize = useGoogleDriveIndexSize();
  const getTagsQuery = useGetTagsQuery();
  const dispatch = useAppDispatch();
  const store = useAppStore();

  const [validationStatus, setValidationStatus] = useState<
    Array<ValidationState>
  >([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerOnDoneRef = useRef<((result: PickerDoneResult) => void) | null>(
    null
  );

  const steps: Array<BackendConfigStep> = [
    {
      label: "Choosing Google Drive resources",
      callable: async () =>
        new Promise((resolve) => {
          pickerOnDoneRef.current = (result: PickerDoneResult) => {
            pickerOnDoneRef.current = null;
            setShowPicker(false);
            resolve(
              result.success
                ? {
                    success: true,
                    nextArg: {
                      bearerToken: result.bearerToken,
                      folders: result.folders,
                      images: result.images,
                    },
                  }
                : { success: false }
            );
          };
          setShowPicker(true);
        }),
    },
    {
      label: "Indexing files",
      callable: async ({
        bearerToken,
        folders,
        images,
      }: {
        bearerToken: string;
        folders: Array<GoogleDriveDoc>;
        images: Array<GoogleDriveDoc>;
      }) => {
        await clientSearchService.indexGoogleDrive(
          dispatch,
          forceUpdate,
          getTagsQuery.data,
          bearerToken,
          folders,
          images
        );
        return { success: true };
      },
    },
  ];

  const chooseGoogleDriveResources = () =>
    evaluateSteps(steps, setValidationStatus);
  const clearGoogleDriveResources = async () => {
    await clientSearchService.clearGoogleDriveIndex(store.getState(), dispatch);
    forceUpdate();
    if (hasGoogleDriveIndex) {
      dispatch(
        setNotification([
          Math.random().toString(),
          {
            name: `Removed Google Drive resources`,
            message: null,
            level: "info",
          },
        ])
      );
    }
    setValidationStatus([]);
  };

  return (
    <>
      <h4>Google Drive</h4>
      <GoogleDrivePicker
        show={showPicker}
        onDone={(result) => pickerOnDoneRef.current?.(result)}
      />
      {hasGoogleDriveIndex && (
        <Alert variant="success">
          You have <b>{googleDriveIndexSize ?? 0}</b> Google Drive images
          indexed.
          <br />
          <br />
          <div className="d-grid gap-0">
            <Button variant="danger" onClick={clearGoogleDriveResources}>
              <RightPaddedIcon bootstrapIconName="eject" />
              Disconnect
            </Button>
          </div>
        </Alert>
      )}
      <p>
        Choose Google Drive files and folder you&apos;d like to connect{" "}
        {ProjectName} to.
      </p>
      <BackendConfigSteps validationStatus={validationStatus} steps={steps} />
      <Row className="g-0">
        <Button variant="outline-primary" onClick={chooseGoogleDriveResources}>
          <RightPaddedIcon bootstrapIconName="plus-circle" />
          Choose Resources
        </Button>
      </Row>
    </>
  );
};
