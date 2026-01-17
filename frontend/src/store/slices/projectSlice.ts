/**
 * State management for the user's configuration of the project - selected cards and cardbacks.
 */

import { createSelector, PayloadAction } from "@reduxjs/toolkit";

import { Card, Cardback } from "@/common/constants";
import { Back, Front, ProjectMaxSize } from "@/common/constants";
import { processPrefix } from "@/common/processing";
import { SourceType } from "@/common/schema_types";
import {
  CardDocuments,
  createAppSlice,
  Faces,
  Project,
  ProjectMember,
  SlotProjectMembers,
  Slots,
} from "@/common/types";
import {
  getCardSizesByIdentifier,
  selectCardSizesByIdentifier,
} from "@/store/slices/cardDocumentsSlice";
import { selectActiveFace } from "@/store/slices/viewSettingsSlice";
import { RootState } from "@/store/store";

//# region slice configuration

const initialState: Project = {
  members: [],
  cardback: null,
  mostRecentlySelectedSlot: null,
};

export const projectSlice = createAppSlice({
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
              cardType: Card,
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
            query: { query: null, cardType: Card },
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
          state.members[slot][face]!.selectedImage = undefined;
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
          query: { query: null, cardType: face === Back ? Cardback : Card },
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
    /**
     * ProjectMaxSize (612 cards at time of writing) is primarily enforced at this layer.
     */
    addMembers: (
      state,
      action: PayloadAction<{ members: Array<SlotProjectMembers> }>
    ) => {
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
    /**
     * This is called when shift-clicking on a card slot. It expands the user's selection
     * between the card they most recently selected and this one - e.g. if the user
     * selected card 1, then selected card 3 with shift-click, both cards 2 and 3 would
     * be selected in this action.
     */
    expandSelection: (
      state,
      action: PayloadAction<{ face: Faces; slot: number }>
    ) => {
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
            query: { query: null, cardType: Card },
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
            projectMember[action.payload.face]?.query?.cardType ===
              selectedMember.query?.cardType
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

const getProjectMember = (
  members: Array<SlotProjectMembers>,
  face: Faces,
  slot: number
) => (members[slot] ?? {})[face];

export const selectProjectMember = createSelector(
  (state: RootState, face: Faces, slot: number) => state.project.members,
  (state: RootState, face: Faces, slot: number) => face,
  (state: RootState, face: Faces, slot: number) => slot,
  getProjectMember
);

const getProjectMemberIdentifiers = (members: Array<SlotProjectMembers>) =>
  new Set(
    members.flatMap((x: SlotProjectMembers) =>
      (x.front?.selectedImage != null ? [x.front.selectedImage] : []).concat(
        x.back?.selectedImage != null ? [x.back.selectedImage] : []
      )
    )
  );

export const selectProjectMemberIdentifiers = createSelector(
  (state: RootState) => state.project.members,
  getProjectMemberIdentifiers
);

export const selectAllSlotsForActiveFace = createSelector(
  (state: RootState) => selectProjectSize(state),
  (state: RootState) => selectActiveFace(state),
  (projectSize, face): Array<[Faces, number]> =>
    Array.from({ length: projectSize }, (_, index) => [face, index])
);

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

/**
 * as in, this doesn't select the unique IDs of the selected cards in the project,
 * but it selects the unique IDs across all search results for everything searched for so far.
 * @param state
 */
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
                  searchQuery.cardType
                ] ?? []
              ).length > 0
              ? (searchResults[searchQuery.query] ?? {})[searchQuery.cardType]
              : [];
          })
        )
        .concat(cardbacks)
    )
);
/**
 * Return the unique card IDs currently selected in `slots`.
 */
export const selectUniqueCardIdentifiersInSlots = createSelector(
  (state: RootState, slots: Slots) => state.project.members,
  (state: RootState, slots: Slots) => slots,
  (members, slots) => {
    const set = new Set<string>();
    slots.map((slot) => {
      const identifier = members[slot[1]]?.[slot[0]]?.selectedImage;
      if (identifier != null) {
        set.add(identifier);
      }
    });
    return set;
  }
);

export const selectProjectSize = (state: RootState): number =>
  state.project.members.length;

export const selectProjectFileSize = createSelector(
  (state: RootState) => state.project.members,
  (state: RootState) => state.cardDocuments.cardDocuments,
  (members, cardDocuments): number => {
    const cardSizesByIdentifier: { [identifier: string]: number } =
      getCardSizesByIdentifier(
        Array.from(getProjectMemberIdentifiers(members)),
        cardDocuments
      );
    return Object.keys(cardSizesByIdentifier).reduce(
      (accumulator: number, identifier: string) => {
        return accumulator + (cardSizesByIdentifier[identifier] ?? 0);
      },
      0
    );
  }
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
          (searchResults[searchQuery.query] ?? {})[searchQuery.cardType] ==
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
  (state: RootState, slots: Slots) => state.project.members,
  (state: RootState, slots: Slots) => slots,
  (state: RootState, slots: Array<[Faces, number]>) =>
    slots.length > 0 ? selectProjectMember(state, ...slots[0])?.query : null,
  (members, slots, firstQuery) => {
    const projectMembers = slots.map((slot) =>
      getProjectMember(members, ...slot)
    );
    return projectMembers.every(
      (projectMember) =>
        (firstQuery?.query == null && projectMember?.query?.query == null) ||
        (firstQuery != null &&
          projectMember?.query?.query == firstQuery.query &&
          projectMember?.query?.cardType == firstQuery.cardType)
    )
      ? firstQuery
      : undefined;
  }
);

export const selectIsProjectEmpty = (state: RootState) =>
  selectProjectSize(state) == 0;

const anyImagesDownloadable = (
  projectMembers: Array<ProjectMember | null>,
  cardDocuments: CardDocuments
) =>
  projectMembers.some(
    (member) =>
      member?.selectedImage !== undefined &&
      cardDocuments[member.selectedImage]?.sourceType === SourceType.GoogleDrive
  );

export const selectAnyImagesDownloadable = createSelector(
  (state: RootState) => state.project.members,
  (state: RootState) => state.cardDocuments.cardDocuments,
  (state: RootState) => selectIsProjectEmpty(state),
  (members, cardDocuments, isProjectEmpty) =>
    !isProjectEmpty &&
    members.some((slotMember) =>
      anyImagesDownloadable([slotMember.front, slotMember.back], cardDocuments)
    )
);

export const selectAnySelectedImagesDownloadable = createSelector(
  (state: RootState, slots: Slots) => state.project.members,
  (state: RootState, slots: Slots) => state.cardDocuments.cardDocuments,
  (state: RootState, slots: Slots) => slots,
  (members, cardDocuments, slots) => {
    const projectMembers = slots.map((slot) =>
      getProjectMember(members, ...slot)
    );
    return anyImagesDownloadable(projectMembers, cardDocuments);
  }
);

export const selectProjectCardback = (state: RootState): string | undefined =>
  state.project.cardback ?? undefined;

//# endregion
