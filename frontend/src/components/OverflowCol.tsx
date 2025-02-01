import Col from "react-bootstrap/Col";
import styled from "styled-components";

import { NavbarHeight, RibbonHeight } from "@/common/constants";

interface OverflowColProps {
  heightDelta?: number;
  scrollable?: boolean;
}

export const OverflowCol = styled(Col)<OverflowColProps>`
  position: relative;
  // define height twice - first as a fallback for older browser compatibility,
  // then using dvh to account for the ios address bar
  height: calc(
    100vh - ${NavbarHeight}px - ${(props) => props.heightDelta ?? 0}px
  );
  height: calc(
    100dvh - ${NavbarHeight}px - ${(props) => props.heightDelta ?? 0}px
  );
  overflow-y: ${(props) => (props.scrollable === false ? "hidden" : "scroll")};
  overscroll-behavior: none;
  scrollbar-width: thin;
`;
