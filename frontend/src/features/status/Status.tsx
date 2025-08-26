import React from "react";

import { InvalidIdentifiersStatus } from "@/features/invalidIdentifiers/InvalidIdentifiersStatus";
import { MobileStatus } from "@/features/mobile/MobileStatus";
import { ProjectStatus } from "@/features/project/ProjectStatus";
import { SearchStatus } from "@/features/search/SearchStatus";

export function Status() {
  return (
    <>
      <MobileStatus />
      <SearchStatus />
      <InvalidIdentifiersStatus />
      <ProjectStatus />
    </>
  );
}
