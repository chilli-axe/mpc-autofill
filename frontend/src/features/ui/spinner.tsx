import React from "react";
import styled from "styled-components";

const SpinnerDimensions = styled.div<{ size?: number }>`
  width: ${(props) => props.size ?? 4}em;
  height: ${(props) => props.size ?? 4}em;
`;

interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 4 }: SpinnerProps) {
  // TODO: this was copied and pasted from the old GUI. check out what react-bootstrap does in this space
  return (
    <div className="d-flex justify-content-center align-items-center">
      <SpinnerDimensions size={size} className="spinner-border" role="status">
        <span className="visually-hidden">Loading...</span>
      </SpinnerDimensions>
    </div>
  );
}
