import React from "react";

export function Spinner() {
  // TODO: this was copied and pasted from the old GUI. check out what react-bootstrap does in this space
  return (
    <div className="d-flex justify-content-center align-items-center">
      <div
        className="spinner-border"
        style={{ width: 4 + "em", height: 4 + "em" }}
        role="status"
      >
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}
