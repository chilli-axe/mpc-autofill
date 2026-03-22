import {
  OAuthErrorEvent,
  OAuthResponseEvent,
  PickerCanceledEvent,
  PickerPickedEvent,
} from "@googleworkspace/drive-picker-element";
import {
  DrivePicker,
  DrivePickerDocsView,
  DrivePickerProps,
} from "@googleworkspace/drive-picker-react";
import { useState } from "react";

import { GoogleDriveDoc, useAppDispatch } from "@/common/types";
import { useGetTagsQuery } from "@/store/api";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { useGoogleDrivePickerContext } from "./googleDrivePickerContext";

interface GoogleDrivePickerProps {}

export const GoogleDrivePicker = ({}: GoogleDrivePickerProps) => {
  const { show, setShow } = useGoogleDrivePickerContext();
  const dispatch = useAppDispatch();
  const { clientSearchService, forceUpdate } = useClientSearchContext();
  const [bearerToken, setBearerToken] = useState<string | undefined>(undefined);
  const getTagsQuery = useGetTagsQuery();
  const onPicked = async (e: PickerPickedEvent) => {
    if (bearerToken) {
      alert("picked!");
      const docs: Array<GoogleDriveDoc> = e.detail.docs;
      console.log("GoogleDrivePicker: onPicked ", e);
      const folders = docs.filter((doc) => doc.type === "folder");
      // const images = docs.filter((doc) => doc.type === "photo");
      clientSearchService.indexGoogleDrive(
        dispatch,
        forceUpdate,
        getTagsQuery.data,
        bearerToken,
        folders
      );
    }
    setShow(false);
  };
  const onOauthResponse = async (e: OAuthResponseEvent) => {
    // TODO: check if success
    setBearerToken(e.detail.access_token);
  };
  const onCanceled = async (e: PickerCanceledEvent) => {
    alert("cancelled!");
    console.log("GoogleDrivePicker: onCanceled ", e);
    setShow(false);
  };
  if (!show) return null;
  return (
    <DrivePicker
      client-id={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID}
      app-id={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID}
      onPicked={onPicked}
      onOauthResponse={onOauthResponse}
      onCanceled={onCanceled}
      scope="https://www.googleapis.com/auth/drive.readonly"
      multiselect={true}
    >
      <DrivePickerDocsView
        select-folder-enabled="true"
        include-folders="true"
      />
    </DrivePicker>
  );
};
