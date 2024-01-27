import React from "react";
import Alert from "react-bootstrap/Alert";

import { ProjectMaxSize } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { bracket, imageSizeToMBString } from "@/common/utils";
import { Jumbotron } from "@/components/jumbotron";
import {
  selectProjectFileSize,
  selectProjectSize,
} from "@/features/project/projectSlice";
import { ViewSettings } from "@/features/viewSettings/viewSettings";

export function ProjectStatus() {
  const projectSize = useAppSelector(selectProjectSize);
  const projectFileSize = useAppSelector(selectProjectFileSize);

  return projectSize > 0 ? (
    <Jumbotron variant="secondary">
      <p>
        Your project contains <b>{projectSize}</b> card
        {projectSize !== 1 && "s"}, belongs in the bracket of up to{" "}
        <b>{bracket(projectSize)}</b> cards, and is{" "}
        <b>{imageSizeToMBString(projectFileSize, 0)}</b> in total.
      </p>
      {projectSize >= ProjectMaxSize && (
        <Alert variant="warning">
          You&apos;ve reached the maximum project size!
        </Alert>
      )}
      <ViewSettings />
    </Jumbotron>
  ) : null;
}
