import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { toggleFaces } from "./viewSettingsSlice";

// @ts-ignore  // TODO: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

export function ViewSettings() {
  const dispatch = useDispatch();
  return (
    <Toggle
      onClick={() => dispatch(toggleFaces())}
      on="Switch to Backs"
      onClassName="flex-centre"
      off="Switch to Fronts"
      offClassName="flex-centre"
      onstyle="info"
      offstyle="info"
      width={100 + "%"}
      size="md"
      height={38 + "px"}
      active={useSelector(
        (state: RootState) => state.viewSettings.frontsVisible
      )}
    />
  );
}
