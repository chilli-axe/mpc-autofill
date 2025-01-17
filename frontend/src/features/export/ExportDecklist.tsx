/**
 * This module contains functionality for generating a decklist representation of the project,
 * suitable for uploading to deckbuilding websites or sending to a friend.
 */

import { saveAs } from "file-saver";
import React from "react";
import Dropdown from "react-bootstrap/Dropdown";

import { RootState } from "@/app/store";
import { Back, Card, FaceSeparator, Front } from "@/common/constants";
import { stripTextInParentheses } from "@/common/processing";
import {
  CardDocuments,
  ProjectMember,
  SlotProjectMembers,
  useAppSelector,
  useAppStore,
} from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import {
  selectIsProjectEmpty,
  selectProjectMembers,
} from "@/features/project/projectSlice";

/**
 * Retrieve the names of each card (note: excludes cardbacks and tokens) in the project.
 */
function extractProjectMemberNames(
  projectMembers: Array<SlotProjectMembers>,
  cardDocuments: CardDocuments
): Array<[string | null, string | null]> {
  function extractProjectMemberName(
    projectMember: ProjectMember | null
  ): string | null {
    return projectMember != null &&
      projectMember.selectedImage != null &&
      Object.prototype.hasOwnProperty.call(
        cardDocuments,
        projectMember.selectedImage
      ) &&
      cardDocuments[projectMember.selectedImage].card_type === Card
      ? stripTextInParentheses(cardDocuments[projectMember.selectedImage].name)
      : null;
  }

  return projectMembers.map((slotProjectMembers: SlotProjectMembers) => [
    extractProjectMemberName(slotProjectMembers[Front]),
    extractProjectMemberName(slotProjectMembers[Back]),
  ]);
}

/**
 * Convert each image's front and back names into a single string.
 * e.g. [["goblin", null], ["mountain", "island"]] => ["goblin", "mountain | island"]
 */
function stringifyCardNames(
  projectMemberNames: Array<[string | null, string | null]>
): Array<string> {
  return projectMemberNames
    .map((item: [string | null, string | null]) =>
      item[0] != null
        ? item[1] != null
          ? `${item[0]} ${FaceSeparator} ${item[1]}`
          : item[0]
        : ""
    )
    .filter((line): line is string => line != null && line.length > 0);
}

/**
 * Count the occurrences of each item in `stringifiedCardNames` and prefix the item with its count.
 * e.g. ["goblin", "goblin"] => ["2x goblin"]
 */
function aggregateIntoQuantities(
  stringifiedCardNames: Array<string>
): Array<string> {
  const aggregated: { [name: string]: number } = stringifiedCardNames.reduce(
    (accumulator: { [name: string]: number }, value) => {
      if (!Object.prototype.hasOwnProperty.call(accumulator, value)) {
        accumulator[value] = 0;
      }
      accumulator[value]++;
      return accumulator;
    },
    {}
  );
  return Object.keys(aggregated)
    .sort()
    .map((key: string) => `${aggregated[key]}x ${key}`);
}

/**
 * Generate a decklist representation of the project, suitable for uploading to deckbuilding websites
 * or sending to a friend. Only includes cards, not cardbacks or tokens.
 */
export function generateDecklist(
  projectMembers: Array<SlotProjectMembers>,
  cardDocuments: CardDocuments
): string {
  const projectMemberNames = extractProjectMemberNames(
    projectMembers,
    cardDocuments
  );
  const stringifiedCardNames = stringifyCardNames(projectMemberNames);
  return aggregateIntoQuantities(stringifiedCardNames).join("\n");
}

const selectGeneratedDecklist = (state: RootState): string => {
  return generateDecklist(
    selectProjectMembers(state),
    state.cardDocuments.cardDocuments
  );
};

export function ExportDecklist() {
  //# region queries and hooks

  const store = useAppStore();
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  //# endregion

  //# region callbacks

  const downloadFile = () => {
    const generatedDecklist = selectGeneratedDecklist(store.getState());
    saveAs(
      new Blob([generatedDecklist], { type: "text/plain;charset=utf-8" }),
      "decklist.txt" // TODO: use project name here when we eventually track that
    );
  };

  //# endregion

  return (
    <Dropdown.Item
      disabled={isProjectEmpty}
      onClick={downloadFile}
      data-testid="export-decklist-button"
    >
      <RightPaddedIcon bootstrapIconName="card-text" /> Decklist
    </Dropdown.Item>
  );
}
