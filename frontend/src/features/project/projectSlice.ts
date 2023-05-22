/**
 * State management for the user's configuration of the project - selected cards and cardbacks.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { RootState } from "@/app/store";
import { Card, ReversedCardTypePrefixes } from "@/common/constants";
import { Back, Front, ProjectMaxSize } from "@/common/constants";
import {
  Faces,
  ProcessedLine,
  Project,
  SearchQuery,
  SlotProjectMembers,
} from "@/common/types";
import { generateDecklist } from "@/features/export/exportDecklist";
import { generateXML } from "@/features/export/exportXML";

const initialState: Project = {
  members: [
    // TODO: clear this initial state. it's just set up like this for easy testing.
    {
      front: {
        query: { query: "island", card_type: Card },
        selectedImage: undefined,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "island", card_type: Card },
        selectedImage: undefined,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "grim monolith", card_type: Card },
        selectedImage: undefined,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "past in flames", card_type: Card },
        selectedImage: undefined,
        selected: false,
      },
      back: null,
    },
    {
      front: {
        query: { query: "necropotence", card_type: Card },
        selectedImage: undefined,
        selected: false,
      },
      back: null,
    },
  ],
  cardback: null,
};

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    setSelectedImage: (
      state,
      action: PayloadAction<{
        face: Faces;
        slot: number;
        selectedImage?: string;
      }>
    ) => {
      // TODO: this is a bit awkward
      if (state.members[action.payload.slot][action.payload.face] == null) {
        state.members[action.payload.slot][action.payload.face] = {
          query: {
            query: null,
            card_type: Card,
          },
          selectedImage: action.payload.selectedImage,
          selected: false,
        };
      } else {
        state.members[action.payload.slot][action.payload.face]!.selectedImage =
          action.payload.selectedImage;
      }
    },
    bulkSetSelectedImage: (
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
        // setSelectedImage(state, {face: action.payload.face, slot: slot, selectedImage: action.payload.selectedImage})
      }
    },
    setSelectedCardback: (
      state,
      action: PayloadAction<{ selectedImage: string }>
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
        state.members[action.payload.slot][action.payload.face]!.selected =
          !state.members[action.payload.slot][action.payload.face]!.selected;
      }
    },
    bulkSetMemberSelection: (
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
            projectMember[action.payload.face]!.query?.query ===
              selectedMember.query.query &&
            projectMember[action.payload.face]!.query?.card_type ===
              selectedMember.query.card_type
          ) {
            projectMember[action.payload.face]!.selected =
              selectedMember.selected;
          }
        }
      }
    },
    deleteSlot: (state, action: PayloadAction<{ slot: number }>) => {
      // TODO: this breaks when you add a DFC card then delete the different card from the project.
      state.members.splice(action.payload.slot, 1);
    },

    // switchToFront: state => {
    //   // Redux Toolkit allows us to write "mutating" logic in reducers. It
    //   // doesn't actually mutate the state because it uses the Immer library,
    //   // which detects changes to a "draft state" and produces a brand new
    //   // immutable state based off those changes
    //   // TODO: make these wrap around
    //   state.activeFace = "front"
    // },
    // switchToBack: state => {
    //   state.activeFace = "back"
    // },
  },
});

export const selectProjectMembers = (
  state: RootState
): Array<SlotProjectMembers> => state.project.members;

// TODO: this is a bit disgusting
export const selectSelectedProjectMembers = (
  state: RootState
): Array<SlotProjectMembers> =>
  state.project.members.flatMap((x: SlotProjectMembers) =>
    (x.front?.selected === true ? [x.front] : []).concat(
      x.back?.selected === true ? [x.back] : []
    )
  );

// TODO: this is disgusting
export const selectProjectMemberQueries = (state: RootState): Set<string> =>
  new Set(
    state.project.members.flatMap((x: SlotProjectMembers) =>
      (x.front?.query?.query != null
        ? [
            ReversedCardTypePrefixes[x.front.query.card_type] +
              x.front.query.query,
          ]
        : []
      ).concat(
        x.back?.query?.query != null
          ? [
              ReversedCardTypePrefixes[x.back.query.card_type] +
                x.back.query.query,
            ]
          : []
      )
    )
  );

export const selectProjectSize = (state: RootState): number =>
  state.project.members.length;

export const selectProjectCardback = (state: RootState): string | null =>
  state.project.cardback;

export const selectGeneratedXML = (state: RootState): string => {
  return generateXML(
    selectProjectMembers(state),
    state.cardDocuments.cardDocuments,
    state.project.cardback,
    selectProjectSize(state)
  );
};

export const selectGeneratedDecklist = (state: RootState): string => {
  return generateDecklist(
    selectProjectMembers(state),
    state.cardDocuments.cardDocuments
  );
};

export const selectProjectFileSize = (state: RootState): number => {
  const uniqueCardIdentifiers = new Set<string>();
  for (const slotProjectMembers of state.project.members) {
    for (const face of [Front, Back]) {
      if (
        slotProjectMembers[face] != null &&
        slotProjectMembers[face].selectedImage != null
      ) {
        uniqueCardIdentifiers.add(slotProjectMembers[face].selectedImage);
      }
    }
  }

  const cardDocuments = state.cardDocuments.cardDocuments;
  return Array.from(uniqueCardIdentifiers).reduce(
    (accumulator: number, identifier: string) => {
      return accumulator + (cardDocuments[identifier] ?? { size: 0 }).size;
    },
    0
  );
};

export const selectUniqueCardIdentifiers = (state: RootState): Set<string> => {
  const allIdentifiers: Set<string> = new Set(state.cardbacks.cardbacks);
  for (const slotProjectMembers of state.project.members) {
    for (const face of [Front, Back]) {
      const projectMember = slotProjectMembers[face];
      if (
        projectMember?.query?.query != null &&
        (
          (state.searchResults.searchResults[projectMember.query.query] ?? {})[
            projectMember.query.card_type
          ] ?? []
        ).length > 0
      ) {
        state.searchResults.searchResults[projectMember.query.query][
          projectMember.query.card_type
        ].forEach((x: string) => allIdentifiers.add(x));
      }
    }
  }
  return allIdentifiers;
};

export const selectQueriesWithoutSearchResults = (
  state: RootState
): Array<SearchQuery> => {
  const queriesToSearch: Array<SearchQuery> = [];
  for (const slotProjectMembers of state.project.members) {
    for (const face of [Front, Back]) {
      const projectMember = slotProjectMembers[face];
      if (
        projectMember?.query?.query != null &&
        (state.searchResults.searchResults[projectMember.query.query] ?? {})[
          projectMember.query.card_type
        ] == null
      ) {
        queriesToSearch.push(projectMember.query);
      }
    }
  }
  return queriesToSearch;
};

// const getProjectCardCount = createSelector(selectProject, project => )

// Action creators are generated for each case reducer function
export const {
  setSelectedImage,
  bulkSetSelectedImage,
  setSelectedCardback,
  addMembers,
  toggleMemberSelection,
  bulkSetMemberSelection,
  deleteSlot,
} = projectSlice.actions;

export default projectSlice.reducer;
