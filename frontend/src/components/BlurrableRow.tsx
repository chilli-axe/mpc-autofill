import styled from "@emotion/styled";
import Row from "react-bootstrap/Row";

interface BlurrableRowProps {
  disabled?: boolean;
}

export const BlurrableRow = styled(Row)<BlurrableRowProps>`
  filter: ${(props) => (props.disabled === true ? "blur(8px)" : undefined)};
  transition: filter 0.2s;
  pointer-events: ${(props) => (props.disabled === true ? "none" : undefined)};
`;
