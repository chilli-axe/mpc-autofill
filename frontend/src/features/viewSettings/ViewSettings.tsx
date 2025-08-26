/**
 * A component to control how Cards in the editor are displayed.
 * At time of writing, this is a simple toggle to choose which face of the cards is shown - front or back.
 */

import React from "react";
// eslint-disable-next-line
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import {
  selectFrontsVisible,
  toggleFaces,
} from "@/store/slices/viewSettingsSlice";

export function ViewSettings() {
  const frontsVisible = useAppSelector(selectFrontsVisible);
  const dispatch = useAppDispatch();
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
      active={frontsVisible}
    />
  );
}
