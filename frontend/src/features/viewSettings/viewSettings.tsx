/**
 * A component to control how Cards in the editor are displayed.
 * At time of writing, this is a simple toggle to choose which face of the cards is shown - front or back.
 */

import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { toggleFaces } from "./viewSettingsSlice";
import { ToggleButtonHeight } from "@/common/constants";

// eslint-disable-next-line
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
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
      height={ToggleButtonHeight + "px"}
      active={useSelector(
        (state: RootState) => state.viewSettings.frontsVisible
      )}
    />
  );
}
