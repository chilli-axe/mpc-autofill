/**
 * State management for the user's configuration of the project - selected cards and cardbacks.
 */

import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { Card, Cardback } from "@/common/constants";
import { Back, Front, ProjectMaxSize } from "@/common/constants";
import { processPrefix } from "@/common/processing";
import {
  Faces,
  Project,
  ProjectMember,
  SlotProjectMembers,
} from "@/common/types";
import { selectCardSizesByIdentifier } from "@/features/search/cardDocumentsSlice";

//# region slice configuration

const initialState: Project = {
  members: [],
  cardback: null,
  mostRecentlySelectedSlot: null,
};

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    bulkReplaceSelectedImage: (
      state,
      action: PayloadAction<{
        face: Faces;
        currentImage: string;
        selectedImage: string;
      }>
    ) => {
      // identify all cards in the specified face which have selected the old image
      // set all those images to the new image

      const mySet: Set<number> = new Set();
      for (const [slot, projectMember] of state.members.entries()) {
        if (
          projectMember[action.payload.face] != null &&
          projectMember[action.payload.face]!.selectedImage ===
            action.payload.currentImage
        ) {
          // TODO: common cardback should also be filtered out here
          mySet.add(slot);
        }
      }
      for (const slot of mySet) {
        // TODO: copied and pasted from above. this is pretty bad.
        if (state.members[slot][action.payload.face] == null) {
          state.members[slot][action.payload.face] = {
            query: {
              query: null,
              card_type: Card,
            },
            selectedImage: action.payload.selectedImage,
            selected: false,
          };
        } else {
          state.members[slot][action.payload.face]!.selectedImage =
            action.payload.selectedImage;
        }
      }
    },
    setSelectedImages: (
      state,
      action: PayloadAction<{
        selectedImage: string | undefined;
        slots: Array<[Faces, number]>;
        deselect?: boolean;
      }>
    ) => {
      for (const [face, slot] of action.payload.slots) {
        if (state.members[slot][face] == null) {
          state.members[slot][face] = {
            query: { query: null, card_type: Card },
            selectedImage: action.payload.selectedImage,
            selected: false,
          };
        } else {
          state.members[slot][face]!.selectedImage =
            action.payload.selectedImage;
          if (action.payload.deselect) {
            state.members[slot][face]!.selected = false;
          }
        }
      }
    },
    setQueries: (
      state,
      action: PayloadAction<{ query: string; slots: Array<[Faces, number]> }>
    ) => {
      const newQuery = processPrefix(action.payload.query);
      for (const [face, slot] of action.payload.slots) {
        if (state.members[slot][face] == null) {
          state.members[slot][face] = {
            query: newQuery,
            selectedImage: undefined,
            selected: false,
          };
        } else {
          state.members[slot][face]!.query = newQuery;
          state.members[slot][face]!.selected = false;
        }
      }
    },
    clearQueries: (
      state,
      action: PayloadAction<{ slots: Array<[Faces, number]> }>
    ) => {
      const projectCardback = state.cardback;
      for (const [face, slot] of action.payload.slots) {
        state.members[slot][face] = {
          query: { query: null, card_type: face === Back ? Cardback : Card },
          selectedImage:
            face === Back && projectCardback != null
              ? projectCardback
              : undefined,
          selected: false,
        };
      }
    },
    setSelectedCardback: (
      state,
      action: PayloadAction<{ selectedImage: string | null }>
    ) => {
      state.cardback = action.payload.selectedImage;
    },
    addMembers: (
      state,
      action: PayloadAction<{ members: Array<SlotProjectMembers> }>
    ) => {
      /**
       * ProjectMaxSize (612 cards at time of writing) is primarily enforced at this layer.
       */

      state.members = [
        ...state.members,
        ...action.payload.members.slice(
          0,
          ProjectMaxSize - state.members.length
        ),
      ];
    },
    toggleMemberSelection: (
      state,
      action: PayloadAction<{
        face: Faces;
        slot: number;
      }>
    ) => {
      if (
        (state.members[action.payload.slot] ?? {})[action.payload.face] != null
      ) {
        const newStatus =
          !state.members[action.payload.slot][action.payload.face]!.selected;
        state.members[action.payload.slot][action.payload.face]!.selected =
          newStatus;
        state.mostRecentlySelectedSlot = newStatus
          ? [action.payload.face, action.payload.slot]
          : null;
      }
    },
    expandSelection: (
      state,
      action: PayloadAction<{ face: Faces; slot: number }>
    ) => {
      /**
       * This is called when shift-clicking on a card slot. It expands the user's selection
       * between the card they most recently selected and this one - e.g. if the user
       * selected card 1, then selected card 3 with shift-click, both cards 2 and 3 would
       * be selected in this action.
       */

      if (
        state.members[action.payload.slot][action.payload.face]?.selected ===
        false
      ) {
        if (state.mostRecentlySelectedSlot == null) {
          // just select this slot
          if (state.members[action.payload.slot][action.payload.face] != null) {
            state.members[action.payload.slot][action.payload.face]!.selected =
              true;
          }
          state.mostRecentlySelectedSlot = [
            action.payload.face,
            action.payload.slot,
          ];
        } else if (action.payload.face === state.mostRecentlySelectedSlot[0]) {
          // expand selection
          for (
            let slot = Math.min(
              action.payload.slot,
              state.mostRecentlySelectedSlot[1]
            );
            slot <=
            Math.max(action.payload.slot, state.mostRecentlySelectedSlot[1]);
            slot++
          ) {
            if (state.members[slot][action.payload.face] != null) {
              state.members[slot][action.payload.face]!.selected = true;
            }
          }
        }
      }
    },
    bulkSetMemberSelection: (
      state,
      action: PayloadAction<{
        selectedStatus: boolean;
        slots: Array<[Faces, number]>;
      }>
    ) => {
      for (const [face, slot] of action.payload.slots) {
        if (state.members[slot][face] == null) {
          state.members[slot][face] = {
            query: { query: null, card_type: Card },
            selectedImage: undefined,
            selected: action.payload.selectedStatus,
          };
        } else {
          state.members[slot][face]!.selected = action.payload.selectedStatus;
        }
      }
      state.mostRecentlySelectedSlot = null;
    },
    bulkAlignMemberSelection: (
      state,
      action: PayloadAction<{
        face: Faces;
        slot: number;
      }>
    ) => {
      const selectedMember = (state.members[action.payload.slot] ?? {})[
        action.payload.face
      ];
      if (selectedMember != null) {
        for (const [slot, projectMember] of state.members.entries()) {
          if (
            projectMember[action.payload.face] != null &&
            projectMember[action.payload.face]?.query?.query ===
              selectedMember.query?.query &&
            projectMember[action.payload.face]?.query?.card_type ===
              selectedMember.query?.card_type
          ) {
            projectMember[action.payload.face]!.selected =
              selectedMember.selected;
          }
        }
      }
      state.mostRecentlySelectedSlot = null;
    },
    deleteSlots: (state, action: PayloadAction<{ slots: Array<number> }>) => {
      action.payload.slots
        .sort(function (a, b) {
          return b - a;
        })
        .forEach(function (index) {
          state.members.splice(index, 1);
        });
    },
  },
});

export const {
  bulkReplaceSelectedImage,
  setSelectedImages,
  setQueries,
  clearQueries,
  setSelectedCardback,
  addMembers,
  toggleMemberSelection,
  expandSelection,
  bulkSetMemberSelection,
  bulkAlignMemberSelection,
  deleteSlots,
} = projectSlice.actions;

export default projectSlice.reducer;

//# endregion

//# region selectors

export const selectProjectMembers = (
  state: RootState
): Array<SlotProjectMembers> => state.project.members;

export const selectProjectMember = (
  state: RootState,
  slot: number,
  face: Faces
): ProjectMember | null => (state.project.members[slot] ?? {})[face];

export const selectProjectMemberIdentifiers = createSelector(
  (state: RootState) => state.project.members,
  (projectMembers) =>
    new Set(
      projectMembers.flatMap((x: SlotProjectMembers) =>
        (x.front?.selectedImage != null ? [x.front.selectedImage] : []).concat(
          x.back?.selectedImage != null ? [x.back.selectedImage] : []
        )
      )
    )
);

export const selectAllSlotsForFace = (
  state: RootState,
  face: Faces
): Array<[Faces, number]> =>
  state.project.members.map((_, index) => [face, index]);

export const selectSelectedSlots = createSelector(
  (state: RootState) => state.project.members,
  (projectMembers) =>
    projectMembers.reduce(
      (accumulator: Array<[Faces, number]>, value, index) => {
        if (value.front?.selected === true) {
          accumulator.push([Front, index]);
        }
        if (value.back?.selected === true) {
          accumulator.push([Back, index]);
        }
        return accumulator;
      },
      []
    )
);

export const selectUniqueCardIdentifiers = createSelector(
  (state: RootState) => state.project.members,
  (state: RootState) => state.searchResults.searchResults,
  (state: RootState) => state.cardbacks.cardbacks,
  (projectMembers, searchResults, cardbacks) =>
    new Set(
      projectMembers
        .flatMap((slotProjectMembers) =>
          [Front, Back].flatMap((face) => {
            const searchQuery = slotProjectMembers[face]?.query;
            return searchQuery?.query != null &&
              (
                (searchResults[searchQuery.query] ?? {})[
                  searchQuery.card_type
                ] ?? []
              ).length > 0
              ? (searchResults[searchQuery.query] ?? {})[searchQuery.card_type]
              : [];
          })
        )
        .concat(cardbacks)
    )
);

export const selectProjectSize = (state: RootState): number =>
  state.project.members.length;

export const selectProjectFileSize = createSelector(
  (state: RootState) =>
    selectCardSizesByIdentifier(
      state,
      Array.from(selectProjectMemberIdentifiers(state))
    ),
  (cardSizesByIdentifier: { [identifier: string]: number }): number =>
    Object.keys(cardSizesByIdentifier).reduce(
      (accumulator: number, identifier: string) => {
        return accumulator + (cardSizesByIdentifier[identifier] ?? 0);
      },
      0
    )
);

export const selectQueriesWithoutSearchResults = createSelector(
  (state: RootState) => state.project.members,
  (state: RootState) => state.searchResults.searchResults,
  (projectMembers, searchResults) => {
    const set = new Set<string>();
    return projectMembers.flatMap((slotProjectMembers) =>
      [Front, Back].flatMap((face) => {
        const searchQuery = slotProjectMembers[face]?.query;
        const stringifiedSearchQuery = JSON.stringify(searchQuery ?? "");
        if (
          searchQuery?.query != null &&
          (searchResults[searchQuery.query] ?? {})[searchQuery.card_type] ==
            null &&
          !set.has(stringifiedSearchQuery)
        ) {
          set.add(stringifiedSearchQuery);
          return [searchQuery];
        } else {
          return [];
        }
      })
    );
  }
);

export const selectAllSelectedProjectMembersHaveTheSameQuery = createSelector(
  (state: RootState, slots: Array<[Faces, number]>) =>
    slots.length > 0
      ? selectProjectMember(state, slots[0][1], slots[0][0])?.query
      : null,
  (state: RootState, slots: Array<[Faces, number]>) =>
    slots.map((slot) => selectProjectMember(state, slot[1], slot[0])),
  (firstQuery, projectMembers) =>
    projectMembers.every(
      (projectMember) =>
        (firstQuery?.query == null && projectMember?.query?.query == null) ||
        (firstQuery != null &&
          projectMember?.query?.query == firstQuery.query &&
          projectMember?.query?.card_type == firstQuery.card_type)
    )
      ? firstQuery
      : undefined
);

export const selectIsProjectEmpty = (state: RootState) =>
  state.project.members.length == 0;

export const selectProjectCardback = (state: RootState): string | undefined =>
  state.project.cardback ?? undefined;

//# endregion
