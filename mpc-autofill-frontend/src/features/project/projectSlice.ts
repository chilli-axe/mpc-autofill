import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Card, ReversedCardTypePrefixes } from "../../common/constants";
import { RootState } from "../../app/store";
import {
  SearchQuery,
  Project,
  SlotProjectMembers,
  Faces,
  ProcessedLine,
} from "../../common/types";
import { generateXML } from "../export/exportXML";
import { generateDecklist } from "../export/exportDecklist";

const initialState: Project = {
  members: [
    {
      front: {
        query: { query: "island", card_type: Card },
        selectedImage: undefined,
      },
      back: null,
    },
    {
      front: {
        query: { query: "grim monolith", card_type: Card },
        selectedImage: undefined,
      },
      back: null,
    },
    {
      front: {
        query: { query: "past in flames", card_type: Card },
        selectedImage: undefined,
      },
      back: null,
    },
    {
      front: {
        query: { query: "necropotence", card_type: Card },
        selectedImage: undefined,
      },
      back: null,
    },
  ],
  cardback: null,
};

interface SetSelectedImageAction {
  face: Faces;
  slot: number;
  selectedImage?: string;
}

interface BulkSetSelectedImageAction {
  face: Faces;
  currentImage: string;
  selectedImage: string;
}

interface SetSelectedCardbackAction {
  selectedImage: string;
}

interface AddImagesAction {
  lines: Array<ProcessedLine>;
}

interface DeleteImageAction {
  slot: number;
}

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    setSelectedImage: (
      state,
      action: PayloadAction<SetSelectedImageAction>
    ) => {
      // TODO: this is a bit awkward
      if (state.members[action.payload.slot][action.payload.face] == null) {
        state.members[action.payload.slot][action.payload.face] = {
          query: {
            query: null,
            card_type: Card,
          },
          selectedImage: action.payload.selectedImage,
        };
      } else {
        state.members[action.payload.slot][action.payload.face]!.selectedImage =
          action.payload.selectedImage;
      }
    },
    bulkSetSelectedImage: (
      state,
      action: PayloadAction<BulkSetSelectedImageAction>
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
      action: PayloadAction<SetSelectedCardbackAction>
    ) => {
      state.cardback = action.payload.selectedImage;
    },
    addImages: (state, action: PayloadAction<AddImagesAction>) => {
      let newMembers: Array<SlotProjectMembers> = [];
      for (const [quantity, frontQuery, backQuery] of action.payload.lines) {
        newMembers = [
          ...newMembers,
          ...Array(quantity).fill({
            front: { query: frontQuery, selectedImage: null },
            back: { query: backQuery, selectedImage: null },
          }),
        ];
      }
      state.members = [...state.members, ...newMembers];
    },
    deleteImage: (state, action: PayloadAction<DeleteImageAction>) => {
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

// TODO: this is disgusting
export const selectProjectMemberQueries = (state: RootState): Set<string> =>
  new Set(
    state.project.members.flatMap((x: SlotProjectMembers) =>
      (x.front?.query?.query != null
        ? [
            ReversedCardTypePrefixes[x.front?.query?.card_type] +
              x.front?.query?.query,
          ]
        : []
      ).concat(
        x.back?.query?.query != null
          ? [
              ReversedCardTypePrefixes[x.back?.query?.card_type] +
                x.back?.query?.query,
            ]
          : []
      )
    )
  );

export const selectProjectSize = (state: RootState): number =>
  state.project.members.length;

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
    for (const projectMember of Object.values(slotProjectMembers)) {
      if (projectMember != null && projectMember.selectedImage != null) {
        uniqueCardIdentifiers.add(projectMember.selectedImage);
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
    for (const projectMember of Object.values(slotProjectMembers)) {
      if (
        projectMember != null &&
        projectMember.query != null &&
        projectMember.query.query != null &&
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
    for (const projectMember of Object.values(slotProjectMembers)) {
      if (
        projectMember != null &&
        projectMember.query != null &&
        projectMember.query.query != null &&
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
  addImages,
  deleteImage,
} = projectSlice.actions;

export default projectSlice.reducer;