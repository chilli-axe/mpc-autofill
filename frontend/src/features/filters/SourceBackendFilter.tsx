import { useEffect } from "react";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { BackendType } from "@/common/types";
import {
  useGoogleDriveBackendConfigured,
  useLocalBackendConfigured,
  useRemoteBackendConfigured,
} from "@/store/slices/backendSlice";

interface SourceBackendFilterProps {
  backendType: BackendType;
  setBackendType: (value: BackendType) => void;
}

export const SourceBackendFilter = ({
  backendType,
  setBackendType,
}: SourceBackendFilterProps) => {
  const remoteBackendConfigured = useRemoteBackendConfigured();
  const localFilesBackendConfigured = useLocalBackendConfigured();
  const googleDriveBackendConfigured = useGoogleDriveBackendConfigured();
  const localBackendConfigured =
    localFilesBackendConfigured || googleDriveBackendConfigured;

  useEffect(() => {
    if (localBackendConfigured && !remoteBackendConfigured)
      setBackendType("local");
    else if (!localBackendConfigured && remoteBackendConfigured)
      setBackendType("remote");
  }, [localBackendConfigured, remoteBackendConfigured]);

  return (
    <>
      <h5>Source Backend</h5>
      <Toggle
        onClick={() =>
          setBackendType(backendType === "remote" ? "local" : "remote")
        }
        on="Remote"
        onClassName="flex-centre"
        off="Local"
        offClassName="flex-centre"
        onstyle="success"
        offstyle="info"
        width={100 + "%"}
        size="md"
        height={ToggleButtonHeight + "px"}
        active={backendType === "remote"}
        disabled={!(remoteBackendConfigured && localBackendConfigured)}
      />
    </>
  );
};
