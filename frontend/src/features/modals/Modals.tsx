import React from "react";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { MemoizedCardDetailedView } from "@/features/cardDetailedView/CardDetailedViewModal";
import { ChangeQueryModal } from "@/features/changeQuery/ChangeQueryModal";
import { FinishedMyProjectModal } from "@/features/export/FinishedMyProjectModal";
import { InvalidIdentifiersModal } from "@/features/invalidIdentifiers/InvalidIdentifiersModal";
import { SupportBackendModal } from "@/features/support/SupportBackendModal";
import { SupportDeveloperModal } from "@/features/support/SupportDeveloperModal";
import {
  hideModal,
  selectModalCard,
  selectModalSlots,
  selectShownModal,
} from "@/store/slices/modalsSlice";

export function Modals() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const selectedImage = useAppSelector(selectModalCard);
  const selectedSlots = useAppSelector(selectModalSlots);
  const shownModal = useAppSelector(selectShownModal);

  //# endregion

  //# region callbacks

  const handleClose = () => dispatch(hideModal());

  //# endregion

  // TODO: move the grid selector into here

  return (
    <>
      {selectedImage != null && (
        <MemoizedCardDetailedView
          cardDocument={selectedImage}
          show={shownModal === "cardDetailedView"}
          handleClose={handleClose}
        />
      )}
      {selectedSlots != null && (
        <ChangeQueryModal
          slots={selectedSlots}
          show={shownModal === "changeQuery"}
          handleClose={handleClose}
        />
      )}
      <FinishedMyProjectModal
        show={shownModal === "finishedMyProject"}
        handleClose={handleClose}
      />
      <SupportDeveloperModal
        show={shownModal === "supportDeveloper"}
        handleClose={handleClose}
      />
      <SupportBackendModal
        show={shownModal === "supportBackend"}
        handleClose={handleClose}
      />
      <InvalidIdentifiersModal
        show={shownModal === "invalidIdentifiers"}
        handleClose={handleClose}
      />
    </>
  );
}
