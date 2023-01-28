import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Card } from "../../common/constants";
import { RootState } from "../../app/store";
import {
  AggregatedQueries,
  SearchQuery,
  Project,
  SlotProjectMembers,
  Faces,
} from "../../common/types";

const initialState: Project = {
  members: [
    {
      front: {
        query: { query: "island", card_type: Card },
        selectedImage: null,
      },
      back: null,
    },
    {
      front: {
        query: { query: "grim monolith", card_type: Card },
        selectedImage: null,
      },
      back: null,
    },
    {
      front: {
        query: { query: "past in flames", card_type: Card },
        selectedImage: null,
      },
      back: null,
    },
    {
      front: {
        query: { query: "necropotence", card_type: Card },
        selectedImage: null,
      },
      back: null,
    },
  ],
  cardback: null,
};

interface SetSelectedImageAction {
  face: Faces;
  slot: number;
  selectedImage: string;
}

interface BulkSetSelectedImageAction {
  face: Faces;
  currentImage: string;
  selectedImage: string;
}

interface SetSelectedCardbackAction {
  selectedImage: string;
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
          query: null,
          selectedImage: action.payload.selectedImage,
        };
      } else {
        state.members[action.payload.slot][action.payload.face].selectedImage =
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
          projectMember[action.payload.face].selectedImage ===
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
            query: null,
            selectedImage: action.payload.selectedImage,
          };
        } else {
          state.members[slot][action.payload.face].selectedImage =
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
    addImages: (state, action: PayloadAction<AggregatedQueries>) => {
      let newMembers: Array<SlotProjectMembers> = [];

      for (const [query, cardTypeToQuantity] of Object.entries(
        action.payload
      )) {
        for (const [cardType, quantity] of Object.entries(cardTypeToQuantity)) {
          newMembers = [
            ...newMembers,
            ...Array(quantity).fill({
              front: {
                query: { query, card_type: cardType },
                selectedImage: null,
              },
              back: null, // TODO: handle DFCs here
            }),
          ];
        }
      }
      state.members = [...state.members, ...newMembers];
    },
    deleteImage: (state, action: PayloadAction<DeleteImageAction>) => {
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

export const selectProjectSize = (state: RootState): number =>
  state.project.members.length;

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
