import React from "react";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { UAParser } from "ua-parser-js";

import { ProjectMaxSize, ProjectName } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { bracket, imageSizeToMBString } from "@/common/utils";
import { SelectedImagesStatus } from "@/features/project/bulkManagement";
import {
  selectProjectFileSize,
  selectProjectSize,
} from "@/features/project/projectSlice";
import { ViewSettings } from "@/features/viewSettings/viewSettings";

function MobileAlert() {
  const ua = UAParser();
  return ua.device.type === "mobile" ? (
    <Alert variant="primary">
      It seems like you&apos;re on a mobile device! The {ProjectName} executable
      that fills your order into MPC requires a desktop computer.
    </Alert>
  ) : (
    <></>
  );
}

// TODO: review the codebase for instances of this https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization

const SizedIcon = styled.i`
  font-size: 1.25rem;
`;

export function ProjectStatus() {
  const projectSize = useAppSelector(selectProjectSize);
  const projectFileSize = useAppSelector(selectProjectFileSize);

  return (
    <>
      <h2>Edit MPC Project</h2>
      <MobileAlert />
      <SelectedImagesStatus />
      {projectSize > 0 && (
        <Alert variant="secondary">
          Your project contains <b>{projectSize}</b> card
          {projectSize !== 1 && "s"}, belongs in the MPC bracket of up to{" "}
          <b>{bracket(projectSize)}</b> cards, and is{" "}
          <b>{imageSizeToMBString(projectFileSize, 0)}</b> in total.
          <br />
          <br />
          {projectSize >= ProjectMaxSize && (
            <Alert variant="warning">
              You&apos;ve reached the maximum project size!
            </Alert>
          )}
          <ViewSettings />
        </Alert>
      )}
    </>
  );
}
