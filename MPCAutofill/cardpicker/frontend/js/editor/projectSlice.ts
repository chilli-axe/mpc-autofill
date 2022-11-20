import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CardTypes, Faces, SearchQuery } from "./constants";
import { RootState } from "./store";

interface ProjectMember {
  query: SearchQuery;
  selectedImage?: string;
}

type ProjectMembers = {
  [face in Faces]: ProjectMember;
};

type Project = {
  [slot: number]: ProjectMembers;
};

const initialState: Project = {
  0: {
    front: {
      query: { query: "island", card_type: CardTypes.Card },
      selectedImage: null,
    },
    back: {
      query: { query: "black lotus", card_type: CardTypes.Cardback },
      selectedImage: null,
    },
  },
  1: {
    front: {
      query: { query: "island", card_type: CardTypes.Card },
      selectedImage: null,
    },
    back: {
      query: { query: "black lotus", card_type: CardTypes.Cardback },
      selectedImage: null,
    },
  },
  2: {
    front: {
      query: { query: "past in flames", card_type: CardTypes.Card },
      selectedImage: null,
    },
    back: {
      query: { query: "black lotus", card_type: CardTypes.Cardback },
      selectedImage: null,
    },
  },
  3: {
    front: {
      query: { query: "necropotence", card_type: CardTypes.Card },
      selectedImage: null,
    },
    back: {
      query: { query: "black lotus", card_type: CardTypes.Cardback },
      selectedImage: null,
    },
  },
};

interface SetSelectedImageAction {
  face: Faces;
  slot: number;
  selectedImage: string;
}

export const projectSlice = createSlice({
  name: "project",
  initialState,
  reducers: {
    setSelectedImage: (
      state,
      action: PayloadAction<SetSelectedImageAction>
    ) => {
      state[action.payload.slot][action.payload.face].selectedImage =
        action.payload.selectedImage;
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
export const { setSelectedImage } = projectSlice.actions;

export default projectSlice.reducer;