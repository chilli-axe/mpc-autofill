import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { RibbonHeight } from "@/common/constants";

export const Ribbon = styled(Row)<{ position?: "top" | "bottom" }>`
  height: ${RibbonHeight}px;
  box-shadow: 0 ${({ position = "top" }) => (position === "top" ? -1 : 1)}px 0
    rgb(255, 255, 255, 50%) inset;
`;
