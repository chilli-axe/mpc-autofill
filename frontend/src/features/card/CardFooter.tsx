import React from "react";
import Button from "react-bootstrap/Button";

import { wrapIndex } from "@/common/utils";

export function CardFooter({
  searchResults,
  selectedImageIndex,
  selected,
  setSelectedImageFromIdentifier,
  handleShowGridSelector,
}: {
  searchResults: Array<string>;
  selectedImageIndex: number | undefined;
  selected: boolean;
  setSelectedImageFromIdentifier: { (image: string): void };
  handleShowGridSelector: { (): void };
}) {
  const setSelectedImageFromDelta = (delta: number): void => {
    // TODO: docstring
    if (selectedImageIndex !== undefined) {
      const image =
        searchResults[
          wrapIndex(selectedImageIndex + delta, searchResults.length)
        ];
      setSelectedImageFromIdentifier(image);
    }
  };

  return (
    <>
      {searchResults.length === 1 && (
        <p className="mpccard-counter text-center align-middle">
          1 / {searchResults.length}
        </p>
      )}
      {searchResults.length > 1 && (
        <>
          <Button
            variant={selected ? "info" : "outline-info"}
            className="mpccard-counter-btn"
            onClick={handleShowGridSelector}
          >
            {(selectedImageIndex ?? 0) + 1} / {searchResults.length}
          </Button>
          <div>
            <Button
              variant={selected ? "info" : "outline-info"}
              className="prev"
              onClick={() => setSelectedImageFromDelta(-1)}
            >
              &#10094;
            </Button>
            <Button
              variant={selected ? "info" : "outline-info"}
              className="next"
              onClick={() => setSelectedImageFromDelta(1)}
            >
              &#10095;
            </Button>
          </div>
        </>
      )}
    </>
  );
}
