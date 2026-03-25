import {
  OAuthErrorEvent,
  OAuthResponseEvent,
  PickerCanceledEvent,
  PickerPickedEvent,
} from "@googleworkspace/drive-picker-element";
import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { useState } from "react";

import { GoogleDriveDoc } from "@/common/types";

export type PickerDoneResult =
  | {
      success: true;
      bearerToken: string;
      folders: Array<GoogleDriveDoc>;
      images: Array<GoogleDriveDoc>;
    }
  | { success: false };

interface GoogleDrivePickerProps {
  show: boolean;
  onDone: (result: PickerDoneResult) => void;
}

export const GoogleDrivePicker = ({ show, onDone }: GoogleDrivePickerProps) => {
  const [bearerToken, setBearerToken] = useState<string | undefined>(undefined);
  const onPicked = async (e: PickerPickedEvent) => {
    if (bearerToken) {
      const docs: Array<GoogleDriveDoc> = e.detail.docs;
      const folders = docs.filter((doc) => doc.type === "folder");
      const images = docs.filter((doc) => doc.type === "photo");
      onDone({ success: true, bearerToken, folders, images });
    } else {
      onDone({ success: false });
    }
  };
  const onOauthResponse = async (e: OAuthResponseEvent) => {
    setBearerToken(e.detail.access_token);
  };
  const onCanceled = async (e: PickerCanceledEvent) => {
    onDone({ success: false });
  };
  const onOauthError = async (e: OAuthErrorEvent) => {
    onDone({ success: false });
  };
  return (
    show && (
      <DrivePicker
        client-id={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID}
        app-id={process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID}
        onPicked={onPicked}
        onOauthResponse={onOauthResponse}
        onCanceled={onCanceled}
        onOauthError={onOauthError}
        scope="https://www.googleapis.com/auth/drive.readonly"
        multiselect={true}
      >
        <DrivePickerDocsView
          select-folder-enabled="true"
          include-folders="true"
        />
      </DrivePicker>
    )
  );
};
