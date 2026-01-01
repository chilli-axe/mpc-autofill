/**
 * This component should be shown when a page relies on data from the configured backend,
 * but no backend is configured.
 */

import { ProjectName } from "@/common/constants";
import { GenericErrorPage } from "@/features/ui/GenericErrorPage";

export function NoBackendDefault() {
  return (
    <GenericErrorPage
      title="No Server Configured"
      text={[
        `You haven't configured any sources for ${ProjectName} just yet.`,
        "Click the Configure Sources button in the top-right to get started!",
      ]}
    />
  );
}
