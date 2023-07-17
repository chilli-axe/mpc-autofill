/**
 * A component to control how Cards in the editor are displayed.
 * At time of writing, this is a simple toggle to choose which face of the cards is shown - front or back.
 */

import React from "react";
// eslint-disable-next-line
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { RootState } from "@/app/store";
import { ToggleButtonHeight } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { toggleFaces } from "@/features/viewSettings/viewSettingsSlice";

export function ViewSettings() {
  const frontsVisible = useAppSelector(
    (state) => state.viewSettings.frontsVisible
  );
  const dispatch = useAppDispatch();
  return (
    <Toggle
      onClick={() => dispatch(toggleFaces())}
      on="Show Fronts"
      onClassName="flex-centre"
      off="Show Backs"
      offClassName="flex-centre"
      onstyle="info"
      offstyle="info"
      width={100 + "%"}
      size="md"
      height={ToggleButtonHeight + "px"}
      active={frontsVisible}
    />
  );
}
