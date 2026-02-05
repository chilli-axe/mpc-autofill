import styled from "@emotion/styled";

interface BlurrableProps {
  disabled?: boolean;
}

export const Blurrable = styled.div<BlurrableProps>`
  filter: ${(props) => (props.disabled === true ? "blur(8px)" : undefined)};
  transition: filter 0.2s;
  pointer-events: ${(props) => (props.disabled === true ? "none" : undefined)};
`;
