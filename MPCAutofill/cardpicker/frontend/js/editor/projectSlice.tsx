import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { CardTypes, Faces, SearchQuery } from "./constants";

interface ProjectMember {
  query: SearchQuery;
  selectedImage?: string;
}

type ProjectMembers = {
  [slot: number]: ProjectMember;
};

type Project = {
  [face in Faces]: ProjectMembers;
};

const initialState: Project = {
  front: {
    0: {
      query: { query: "island", card_type: CardTypes.Card },
      selectedImage: null,
    },
    1: {
      query: { query: "island", card_type: CardTypes.Card },
      selectedImage: null,
    },
    2: {
      query: { query: "past in flames", card_type: CardTypes.Card },
      selectedImage: null,
    },
    3: {
      query: { query: "past in flames", card_type: CardTypes.Card },
      selectedImage: null,
    },
  },
  back: {},
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
      state[action.payload.face][action.payload.slot].selectedImage =
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

// Action creators are generated for each case reducer function
export const { setSelectedImage } = projectSlice.actions;

export default projectSlice.reducer;
