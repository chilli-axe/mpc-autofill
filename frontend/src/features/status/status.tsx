import React from "react";

import { SelectedImagesStatus } from "@/features/bulkManagement/bulkManagementStatus";
import { InvalidIdentifiersStatus } from "@/features/invalidIdentifiers/invalidIdentifiersStatus";
import { MobileStatus } from "@/features/mobile/mobileStatus";
import { ProjectStatus } from "@/features/project/projectStatus";

export function Status() {
  return (
    <>
      <h2>Edit Project</h2>
      <MobileStatus />
      <SelectedImagesStatus />
      <InvalidIdentifiersStatus />
      <ProjectStatus />
    </>
  );
}
