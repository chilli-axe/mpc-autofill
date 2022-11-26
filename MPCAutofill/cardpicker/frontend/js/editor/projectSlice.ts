import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CardTypes, Faces, SearchQuery } from "./constants";
import { RootState } from "./store";

interface ProjectMember {
  query: SearchQuery;
  selectedImage?: string;
}

type SlotProjectMembers = {
  [face in Faces]: ProjectMember;
};

type Project = {
  members: Array<SlotProjectMembers>;
};

const initialState: Project = {
  members: [
    {
      front: {
        query: { query: "island", card_type: CardTypes.Card },
        selectedImage: null,
      },
      back: {
        query: { query: "black lotus", card_type: CardTypes.Cardback },
        selectedImage: null,
      },
    },
    {
      front: {
        query: { query: "grim monolith", card_type: CardTypes.Card },
        selectedImage: null,
      },
      back: {
        query: { query: "black lotus", card_type: CardTypes.Cardback },
        selectedImage: null,
      },
    },
    {
      front: {
        query: { query: "past in flames", card_type: CardTypes.Card },
        selectedImage: null,
      },
      back: {
        query: { query: "black lotus", card_type: CardTypes.Cardback },
        selectedImage: null,
      },
    },
    {
      front: {
        query: { query: "necropotence", card_type: CardTypes.Card },
        selectedImage: null,
      },
      back: {
        query: { query: "black lotus", card_type: CardTypes.Cardback },
        selectedImage: null,
      },
    },
  ],
};

interface SetSelectedImageAction {
  face: Faces;
  slot: number;
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
      state.members[action.payload.slot][action.payload.face].selectedImage =
        action.payload.selectedImage;
    },
    addImages: (state, action) => {
      let newMembers: Array<SlotProjectMembers> = [];

      for (const [key, value] of Object.entries(action.payload)) {
        // @ts-ignore  // TODO
        newMembers = [
          ...newMembers,
          ...Array(value).fill({
            front: {
              query: { query: key, card_type: CardTypes.Card },
              selectedImage: null,
            },
            back: {
              query: { query: "black lotus", card_type: CardTypes.Cardback },
              selectedImage: null,
            },
          }),
        ];
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

const selectProject = (state: RootState) => state.project;
// const getProjectCardCount = createSelector(selectProject, project => )

// Action creators are generated for each case reducer function
export const { setSelectedImage, addImages, deleteImage } =
  projectSlice.actions;

export default projectSlice.reducer;
