import React from "react";

import { InvalidIdentifiersStatus } from "@/features/invalidIdentifiers/InvalidIdentifiersStatus";
import { ProjectStatus } from "@/features/project/ProjectStatus";

export function Status() {
  return (
    <>
      <InvalidIdentifiersStatus />
      <ProjectStatus />
    </>
  );
}
