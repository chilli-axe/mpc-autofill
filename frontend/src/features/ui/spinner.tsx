import React from "react";
import styled from "styled-components";

const SpinnerDimensions = styled.div`
  width: 4em;
  height: 4em;
`;

export function Spinner() {
  // TODO: this was copied and pasted from the old GUI. check out what react-bootstrap does in this space
  return (
    <div className="d-flex justify-content-center align-items-center">
      <SpinnerDimensions className="spinner-border" role="status">
        <span className="visually-hidden">Loading...</span>
      </SpinnerDimensions>
    </div>
  );
}
