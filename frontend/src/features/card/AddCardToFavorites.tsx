import React from "react";
import Button from "react-bootstrap/Button";

import { CardDocument, useAppDispatch, useAppSelector } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import {
  selectIsFavoriteRender,
  toggleFavoriteRender,
} from "@/store/slices/favoritesSlice";
import { setNotification } from "@/store/slices/toastsSlice";

export function AddCardToFavorites({
  cardDocument,
}: {
  cardDocument: CardDocument;
}) {
  const dispatch = useAppDispatch();
  const isFavorite = useAppSelector((state) =>
    selectIsFavoriteRender(state, cardDocument.searchq, cardDocument.identifier)
  );

  const handleToggleFavorite = () => {
    dispatch(
      toggleFavoriteRender({
        searchq: cardDocument.searchq,
        identifier: cardDocument.identifier,
      })
    );
    dispatch(
      setNotification([
        Math.random().toString(),
        {
          name: isFavorite ? "Removed from Favorites" : "Added to Favorites",
          message: isFavorite
            ? `Removed ${cardDocument.name} from your favorites.`
            : `Added ${cardDocument.name} to your favorites!`,
          level: "info",
        },
      ])
    );
  };

  return (
    <div className="d-grid gap-0 pt-3">
      <Button
        variant={isFavorite ? "info" : "outline-info"}
        onClick={handleToggleFavorite}
      >
        <RightPaddedIcon
          bootstrapIconName={isFavorite ? "heart-fill" : "heart"}
        />{" "}
        {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
      </Button>
    </div>
  );
}
