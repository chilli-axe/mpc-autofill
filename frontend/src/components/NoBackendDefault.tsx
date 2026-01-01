/**
 * This component should be shown when a page relies on data from the configured backend,
 * but no backend is configured.
 */

import { ProjectName } from "@/common/constants";
import { assertUnreachable } from "@/common/utils";
import { GenericErrorPage } from "@/features/ui/GenericErrorPage";

interface NoBackendDefaultProps {
  requirement: "any" | "remote";
}

export function NoBackendDefault({ requirement }: NoBackendDefaultProps) {
  switch (requirement) {
    case "remote":
      return (
        <GenericErrorPage
          title="No Server Configured"
          text={[
            `You haven't configured a server for ${ProjectName} just yet.`,
            "Click the Sources button in the top-right to get started!",
          ]}
        />
      );
    case "any":
      return (
        <GenericErrorPage
          title="No Sources Configured"
          text={[
            `You haven't configured any sources for ${ProjectName} just yet.`,
            "Click the Sources button in the top-right to get started!",
          ]}
        />
      );
  }
  assertUnreachable(requirement);
}
