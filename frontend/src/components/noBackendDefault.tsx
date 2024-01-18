/**
 * This component should be shown when a page relies on data from the configured backend,
 * but no backend is configured.
 */

import { ProjectName } from "@/common/constants";
import { GenericErrorPage } from "@/features/ui/genericErrorPage";

export function NoBackendDefault() {
  return (
    <GenericErrorPage
      title="No Server Configured"
      text={[
        `You haven't configured a server for ${ProjectName} to communicate with just yet.`,
        "Click the Configure Server button in the top-right to get started!",
      ]}
    />
  );
}
