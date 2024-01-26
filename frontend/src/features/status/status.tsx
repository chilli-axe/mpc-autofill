import React from "react";

import { SelectedImagesStatus } from "@/features/bulkManagement/bulkManagementStatus";
import { InvalidIdentifiersStatus } from "@/features/invalidIdentifiers/invalidIdentifiersStatus";
import { MobileStatus } from "@/features/mobile/mobileStatus";
import { ProjectStatus } from "@/features/project/projectStatus";
import { SearchStatus } from "@/features/search/searchStatus";

export function Status() {
  return (
    <>
      <MobileStatus />
      <SearchStatus />
      <SelectedImagesStatus />
      <InvalidIdentifiersStatus />
      <ProjectStatus />
    </>
  );
}
