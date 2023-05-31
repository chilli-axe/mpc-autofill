/**
 * This component should be shown when a page relies on data from the configured backend,
 * but no backend is configured.
 */

import styled from "styled-components";

import { ProjectName } from "@/common/constants";

const NoBackendDefaultTextWrapper = styled.div`
  position: absolute;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  text-align: center;
`;

export const NoBackendDefaultText = styled.p`
  font-size: 1.25em;
`;

export function NoBackendDefault() {
  return (
    <NoBackendDefaultTextWrapper>
      <NoBackendDefaultText>
        You haven&apos;t configured a server for {ProjectName} to communicate
        with just yet.
      </NoBackendDefaultText>
      <NoBackendDefaultText>
        Click the <b>Configure Server</b> button in the top-right to get
        started!
      </NoBackendDefaultText>
    </NoBackendDefaultTextWrapper>
  );
}
