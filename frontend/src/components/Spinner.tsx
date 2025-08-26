import React from "react";
import styled from "styled-components";

interface SpinnerProps {
  size?: number;
  zIndex?: number;
  positionAbsolute?: boolean;
}

const SpinnerDimensions = styled.div<SpinnerProps>`
  width: ${(props) => props.size ?? 4}em;
  height: ${(props) => props.size ?? 4}em;
  z-index: ${(props) => props.zIndex};
  position: ${({ positionAbsolute = false }) =>
    positionAbsolute ? "absolute" : ""};
  top: ${({ size = 4, positionAbsolute = false }) =>
    positionAbsolute ? `calc(50% - ${size}em / 2)` : ""};
  left: ${({ size = 4, positionAbsolute = false }) =>
    positionAbsolute ? `calc(50% - ${size}em / 2)` : ""};
`;

export function Spinner({
  size = 4,
  zIndex = 0,
  positionAbsolute = false,
}: SpinnerProps) {
  // TODO: this was copied and pasted from the old GUI. check out what react-bootstrap does in this space
  return (
    <div className="d-flex justify-content-center align-items-center">
      <SpinnerDimensions
        size={size}
        zIndex={zIndex}
        positionAbsolute={positionAbsolute}
        className="spinner-border"
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </SpinnerDimensions>
    </div>
  );
}
