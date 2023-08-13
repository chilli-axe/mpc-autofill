import React from "react";

import { useAppDispatch, useAppSelector } from "@/common/types";
import { MemoizedCardDetailedView } from "@/features/modals/cardDetailedViewModal";
import { ChangeQueryModal } from "@/features/modals/changeQueryModal";
import {
  hideModal,
  selectModalCard,
  selectModalSlots,
  selectShownModal,
} from "@/features/modals/modalsSlice";
import { SupportBackendModal } from "@/features/modals/supportBackendModal";
import { SupportDeveloperModal } from "@/features/modals/supportDeveloperModal";

export function Modals() {
  // TODO: move the grid selector into here
  const selectedImage = useAppSelector(selectModalCard);
  const selectedSlots = useAppSelector(selectModalSlots);
  const shownModal = useAppSelector(selectShownModal);
  const dispatch = useAppDispatch();
  const handleClose = () => dispatch(hideModal());

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
      <SupportDeveloperModal
        show={shownModal === "supportDeveloper"}
        handleClose={handleClose}
      />
      <SupportBackendModal
        show={shownModal === "supportBackend"}
        handleClose={handleClose}
      />
    </>
  );
}
