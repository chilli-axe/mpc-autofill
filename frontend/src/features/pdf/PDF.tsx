import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React, { createContext, useContext } from "react";

import {
  BleedEdgeMM,
  CardHeightMM,
  CardWidthMM,
  CornerRadiusMM,
} from "@/common/constants";
import { CardDocument, SlotProjectMembers } from "@/common/types";
import { getPDFImageURL, PDFImageQuality } from "@/features/pdf/pdfImage";
import {
  ScmPaperSize,
  ScmRegistration,
  ScmVariant,
} from "@/features/pdf/scm/scmLayout";
import { SCMPDF } from "@/features/pdf/scm/SCMPDF";

const PDFContext = createContext<PDFProps | undefined>(undefined);

const usePDFContext = (): PDFProps => {
  const context = useContext(PDFContext);
  if (!context) {
    throw new Error("Attempted to use pdfContext outside of provider");
  }
  return context;
};

// copy-pasted from react-pdf because they don't export this data
// measured in PDF points
const SIZES: { [key: string]: { width: number; height: number } } = {
  "4A0": { width: 4767.87, height: 6740.79 },
  "2A0": { width: 3370.39, height: 4767.87 },
  A0: { width: 2383.94, height: 3370.39 },
  A1: { width: 1683.78, height: 2383.94 },
  A2: { width: 1190.55, height: 1683.78 },
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  A6: { width: 297.64, height: 419.53 },
  A7: { width: 209.76, height: 297.64 },
  A8: { width: 147.4, height: 209.76 },
  A9: { width: 104.88, height: 147.4 },
  A10: { width: 73.7, height: 104.88 },
  B0: { width: 2834.65, height: 4008.19 },
  B1: { width: 2004.09, height: 2834.65 },
  B2: { width: 1417.32, height: 2004.09 },
  B3: { width: 1000.63, height: 1417.32 },
  B4: { width: 708.66, height: 1000.63 },
  B5: { width: 498.9, height: 708.66 },
  B6: { width: 354.33, height: 498.9 },
  B7: { width: 249.45, height: 354.33 },
  B8: { width: 175.75, height: 249.45 },
  B9: { width: 124.72, height: 175.75 },
  B10: { width: 87.87, height: 124.72 },
  C0: { width: 2599.37, height: 3676.54 },
  C1: { width: 1836.85, height: 2599.37 },
  C2: { width: 1298.27, height: 1836.85 },
  C3: { width: 918.43, height: 1298.27 },
  C4: { width: 649.13, height: 918.43 },
  C5: { width: 459.21, height: 649.13 },
  C6: { width: 323.15, height: 459.21 },
  C7: { width: 229.61, height: 323.15 },
  C8: { width: 161.57, height: 229.61 },
  C9: { width: 113.39, height: 161.57 },
  C10: { width: 79.37, height: 113.39 },
  RA0: { width: 2437.8, height: 3458.27 },
  RA1: { width: 1729.13, height: 2437.8 },
  RA2: { width: 1218.9, height: 1729.13 },
  RA3: { width: 864.57, height: 1218.9 },
  RA4: { width: 609.45, height: 864.57 },
  SRA0: { width: 2551.18, height: 3628.35 },
  SRA1: { width: 1814.17, height: 2551.18 },
  SRA2: { width: 1275.59, height: 1814.17 },
  SRA3: { width: 907.09, height: 1275.59 },
  SRA4: { width: 637.8, height: 907.09 },
  EXECUTIVE: { width: 521.86, height: 756.0 },
  FOLIO: { width: 612.0, height: 936.0 },
  LEGAL: { width: 612.0, height: 1008.0 },
  LETTER: { width: 612.0, height: 792.0 },
  TABLOID: { width: 792.0, height: 1224.0 },
} as const;

const pdfPointsToMM = (pdfPoints: number) => (pdfPoints / 72) * 25.4;

const getPageSizeMM = (
  pageSize: keyof typeof PageSize,
  pageWidth: number | undefined,
  pageHeight: number | undefined
) => {
  if (
    pageSize === "CUSTOM" &&
    pageWidth !== undefined &&
    pageHeight !== undefined
  ) {
    return { width: pageWidth, height: pageHeight };
  } else {
    const pdfPointsSize =
      SIZES[pageSize as keyof Omit<typeof PageSize, "CUSTOM">];
    return {
      width: pdfPointsToMM(pdfPointsSize.width),
      height: pdfPointsToMM(pdfPointsSize.height),
    };
  }
};

const calculateCardContainerDimension = (
  pageSizeMM: number,
  cardSizeMM: number,
  bleedEdgeMM: number,
  cardSpacingMM: number,
  pageMarginStartMM: number,
  pageMarginEndMM: number
) => {
  const maxWidth = pageSizeMM - (pageMarginStartMM + pageMarginEndMM);
  const calculateContainerWidth = (cardsFitted: number) =>
    // adding a small buffer of 0.1 mm as I observed some weird wrapping behaviour from react-pdf without this
    cardsFitted * (cardSizeMM + 2 * bleedEdgeMM) +
    (cardsFitted - 1) * cardSpacingMM +
    0.1;
  let cardsFitted = 1;
  while (true) {
    const containerWidth = calculateContainerWidth(cardsFitted);
    if (containerWidth < maxWidth) {
      cardsFitted++;
    } else {
      return calculateContainerWidth(Math.max(1, cardsFitted - 1));
    }
  }
};

const calculateCardContainerWidth = (
  pageWidthMM: number,
  bleedEdgeMM: number,
  cardSpacingColMM: number,
  pageMarginLeftMM: number,
  pageMarginRightMM: number
) =>
  calculateCardContainerDimension(
    pageWidthMM,
    CardWidthMM,
    bleedEdgeMM,
    cardSpacingColMM,
    pageMarginLeftMM,
    pageMarginRightMM
  );

const calculateCardContainerHeight = (
  pageHeightMM: number,
  bleedEdgeMM: number,
  cardSpacingRowMM: number,
  pageMarginTopMM: number,
  pageMarginBottomMM: number
) =>
  calculateCardContainerDimension(
    pageHeightMM,
    CardHeightMM,
    bleedEdgeMM,
    cardSpacingRowMM,
    pageMarginTopMM,
    pageMarginBottomMM
  );

const getCardsPerRow = (
  containerWidthMM: number,
  bleedEdgeMM: number,
  cardSpacingColMM: number
) => {
  const cardSlotWidth = CardWidthMM + 2 * bleedEdgeMM;
  return Math.round(
    (containerWidthMM - 0.1 + cardSpacingColMM) /
      (cardSlotWidth + cardSpacingColMM)
  );
};

const getCardsPerCol = (
  containerHeightMM: number,
  bleedEdgeMM: number,
  cardSpacingRowMM: number
) => {
  const cardSlotHeight = CardHeightMM + 2 * bleedEdgeMM;
  return Math.round(
    (containerHeightMM - 0.1 + cardSpacingRowMM) /
      (cardSlotHeight + cardSpacingRowMM)
  );
};

export const PageSize = {
  A4: "A4",
  A3: "A3",
  LETTER: "LETTER",
  LEGAL: "LEGAL",
  TABLOID: "TABLOID",
  CUSTOM: "Custom", // special case
} as const;

export const CutLinePlacement = {
  Inside: "Inside",
  Centre: "Centre",
  Outside: "Outside",
} as const;

export const CutLineShape = {
  Cross: "Cross Shaped",
  InsideOnly: "Inside Card Border",
  OutsideOnly: "Outside Card Border",
};

export const CardSelectionMode = {
  frontsAndDistinctBacks: "Fronts + Distinct Backs",
  frontsOnly: "Fronts Only",
  frontsAndBacks: "Fronts + Backs",
  backsOnly: "Backs Only",
} as const;

// Create styles
const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
});

export interface PDFProps {
  cardSelectionMode: keyof typeof CardSelectionMode;
  cutLinePlacement: keyof typeof CutLinePlacement;
  cutLineShape: keyof typeof CutLineShape;
  pageSize: keyof typeof PageSize;
  pageWidth: number | undefined;
  pageHeight: number | undefined;
  bleedEdgeMM: number;
  roundCorners: boolean;
  drawCardCutLines: boolean;
  drawPageCutLines: boolean;
  cutLineLengthMM: number;
  cutLineOffsetMM: number;
  cutLineThicknessMM: number;
  cutLineColor: string;
  cardSpacingRowMM: number;
  cardSpacingColMM: number;
  pageMarginTopMM: number;
  pageMarginBottomMM: number;
  pageMarginLeftMM: number;
  pageMarginRightMM: number;
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument };
  projectMembers: Array<SlotProjectMembers>;
  projectCardback: string | undefined;
  imageQuality: PDFImageQuality;
  imageDPI: number | undefined;
  jpgQuality: number;
  fileHandles: { [identifier: string]: FileSystemFileHandle };
  // SCM (Silhouette Card Maker) mode. When scmMode is true, the standard
  // parametric layout above is ignored in favour of an SCM-template-compatible
  // layout with registration marks (see scm/SCMPDF.tsx).
  scmMode: boolean;
  scmPaperSize: ScmPaperSize;
  scmVariant: ScmVariant;
  scmRegistration: ScmRegistration;
  scmDuplex: boolean;
  scmOffsetXMM: number;
  scmOffsetYMM: number;
  scmOffsetAngleDeg: number;
}

interface PDFCardThumbnailProps {
  cardDocument: CardDocument;
}

type CutLineCornerPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface CutLineCornerProps {
  position: CutLineCornerPosition;
  lengthMM: number;
  placement: keyof typeof CutLinePlacement;
  shape: keyof typeof CutLineShape;
  horizontalLeftLengthOverrideMM?: number;
  horizontalRightLengthOverrideMM?: number;
  verticalUpLengthOverrideMM?: number;
  verticalDownLengthOverrideMM?: number;
}

const CutLineCorner = ({
  position,
  lengthMM,
  placement,
  shape,
  horizontalLeftLengthOverrideMM,
  horizontalRightLengthOverrideMM,
  verticalUpLengthOverrideMM,
  verticalDownLengthOverrideMM,
}: CutLineCornerProps) => {
  const { cutLineThicknessMM, cutLineColor, bleedEdgeMM, cutLineOffsetMM } =
    usePDFContext();

  const cutLinePlacementToThicknessOffset: {
    [key in keyof typeof CutLinePlacement]: number;
  } = {
    [CutLinePlacement.Inside]: 0,
    [CutLinePlacement.Centre]: 0.5 * cutLineThicknessMM,
    [CutLinePlacement.Outside]: cutLineThicknessMM,
  };

  const totalOffset =
    bleedEdgeMM -
    cutLineOffsetMM -
    cutLinePlacementToThicknessOffset[placement];

  const positionLookup: {
    [location in CutLineCornerPosition]: {
      horizontal: "left" | "right";
      vertical: "up" | "down";
      verticalCssProperty: "top" | "bottom";
      horizontalCssProperty: "left" | "right";
    };
  } = {
    "top-left": {
      horizontal: "right",
      vertical: "down",
      verticalCssProperty: "top",
      horizontalCssProperty: "left",
    },
    "top-right": {
      horizontal: "left",
      vertical: "down",
      verticalCssProperty: "top",
      horizontalCssProperty: "right",
    },
    "bottom-left": {
      horizontal: "right",
      vertical: "up",
      verticalCssProperty: "bottom",
      horizontalCssProperty: "left",
    },
    "bottom-right": {
      horizontal: "left",
      vertical: "up",
      verticalCssProperty: "bottom",
      horizontalCssProperty: "right",
    },
  };

  const inside = positionLookup[position];
  const outside = {
    horizontal: inside.horizontal === "left" ? "right" : "left",
    vertical: inside.vertical === "up" ? "down" : "up",
  } as const;

  const showHorizontal = (dir: "left" | "right") => {
    if (shape === "Cross") return true;
    if (shape === "InsideOnly") return inside.horizontal === dir;
    if (shape === "OutsideOnly") return outside.horizontal === dir;
    return false;
  };

  const showVertical = (dir: "up" | "down") => {
    if (shape === "Cross") return true;
    if (shape === "InsideOnly") return inside.vertical === dir;
    if (shape === "OutsideOnly") return outside.vertical === dir;
    return false;
  };

  return (
    <>
      <View
        style={{
          position: "absolute" as const,
          ...(inside.verticalCssProperty === "top" && {
            top: totalOffset + "mm",
          }),
          ...(inside.verticalCssProperty === "bottom" && {
            bottom: totalOffset + cutLineThicknessMM + "mm",
          }),
          ...(inside.horizontalCssProperty === "left" && {
            left: totalOffset + "mm",
          }),
          ...(inside.horizontalCssProperty === "right" && {
            right: totalOffset + cutLineThicknessMM + "mm",
          }),
        }}
      >
        {showVertical("down") && (
          <View
            style={{
              // lower vertical bar
              position: "absolute" as const,
              width: cutLineThicknessMM + "mm",
              height: (verticalDownLengthOverrideMM ?? lengthMM) + "mm",
              backgroundColor: cutLineColor,
              top: 0,
              left: 0,
            }}
          />
        )}
        {showVertical("up") && (
          <View
            style={{
              // upper vertical bar
              position: "absolute" as const,
              width: cutLineThicknessMM + "mm",
              height: (verticalUpLengthOverrideMM ?? lengthMM) + "mm",
              backgroundColor: cutLineColor,
              top:
                -(verticalUpLengthOverrideMM ?? lengthMM) +
                cutLineThicknessMM +
                "mm",
              left: 0,
            }}
          />
        )}
        {showHorizontal("right") && (
          <View
            style={{
              // right horizontal bar
              position: "absolute" as const,
              width: (horizontalRightLengthOverrideMM ?? lengthMM) + "mm",
              height: cutLineThicknessMM + "mm",
              backgroundColor: cutLineColor,
              top: 0,
              left: 0,
            }}
          />
        )}
        {showHorizontal("left") && (
          <View
            style={{
              // left horizontal bar
              position: "absolute" as const,
              width: (horizontalLeftLengthOverrideMM ?? lengthMM) + "mm",
              height: cutLineThicknessMM + "mm",
              backgroundColor: cutLineColor,
              top: 0,
              left:
                -(horizontalLeftLengthOverrideMM ?? lengthMM) +
                cutLineThicknessMM +
                "mm",
            }}
          />
        )}
      </View>
    </>
  );
};

// Renders only the card image, with no cut lines.
const PDFCardImage = ({ cardDocument }: PDFCardThumbnailProps) => {
  const {
    bleedEdgeMM,
    roundCorners,
    imageQuality,
    imageDPI,
    jpgQuality,
    fileHandles,
  } = usePDFContext();
  const height = CardHeightMM + 2 * bleedEdgeMM;
  const heightProportion = (CardHeightMM + 2 * BleedEdgeMM) / height;
  const width = CardWidthMM + 2 * bleedEdgeMM;
  const widthProportion = (CardWidthMM + 2 * BleedEdgeMM) / width;
  const radius = roundCorners ? CornerRadiusMM : 0;

  return (
    <View
      style={{
        width: width + "mm",
        minWidth: width + "mm",
        height: height + "mm",
        minHeight: height + "mm",
      }}
    >
      <Image
        src={async () =>
          getPDFImageURL(
            cardDocument,
            imageQuality,
            imageDPI,
            jpgQuality,
            fileHandles
          )
        }
        style={
          {
            width: width + "mm",
            minWidth: width + "mm",
            height: height + "mm",
            minHeight: height + "mm",
            transform: `scale(${widthProportion}, ${heightProportion})`,
            overflow: "hidden",
            borderTopLeftRadius: radius + "mm",
            borderTopRightRadius: radius + "mm",
            borderBottomRightRadius: radius + "mm",
            borderBottomLeftRadius: radius + "mm",
          } as const
        }
      />
    </View>
  );
};

// Renders cut lines for a single card slot, absolutely positioned within the
// overlay layer to match the card at (colIndex, rowIndex) in the grid.
const PDFCardCutLines = ({
  colIndex,
  rowIndex,
}: {
  colIndex: number;
  rowIndex: number;
}) => {
  const {
    bleedEdgeMM,
    cardSpacingRowMM,
    cardSpacingColMM,
    cutLineLengthMM,
    cutLinePlacement,
    cutLineShape,
  } = usePDFContext();
  const cardSlotWidth = CardWidthMM + 2 * bleedEdgeMM;
  const cardSlotHeight = CardHeightMM + 2 * bleedEdgeMM;

  const left = colIndex * (cardSlotWidth + cardSpacingColMM);
  const top = rowIndex * (cardSlotHeight + cardSpacingRowMM);

  return (
    <View
      style={{
        position: "absolute" as const,
        left: left + "mm",
        top: top + "mm",
        width: cardSlotWidth + "mm",
        height: cardSlotHeight + "mm",
      }}
    >
      <CutLineCorner
        position="top-left"
        lengthMM={cutLineLengthMM}
        placement={cutLinePlacement}
        shape={cutLineShape}
      />
      <CutLineCorner
        position="top-right"
        lengthMM={cutLineLengthMM}
        placement={cutLinePlacement}
        shape={cutLineShape}
      />
      <CutLineCorner
        position="bottom-left"
        lengthMM={cutLineLengthMM}
        placement={cutLinePlacement}
        shape={cutLineShape}
      />
      <CutLineCorner
        position="bottom-right"
        lengthMM={cutLineLengthMM}
        placement={cutLinePlacement}
        shape={cutLineShape}
      />
    </View>
  );
};

const PageCutLines = ({
  colIndex,
  rowIndex,
}: {
  colIndex: number;
  rowIndex: number;
}) => {
  const {
    bleedEdgeMM,
    cardSpacingRowMM,
    cardSpacingColMM,
    pageSize,
    pageWidth,
    pageHeight,
    pageMarginLeftMM,
    pageMarginRightMM,
    pageMarginTopMM,
    pageMarginBottomMM,
    cutLineLengthMM,
  } = usePDFContext();
  const cardSlotWidth = CardWidthMM + 2 * bleedEdgeMM;
  const cardSlotHeight = CardHeightMM + 2 * bleedEdgeMM;

  const left = colIndex * (cardSlotWidth + cardSpacingColMM);
  const top = rowIndex * (cardSlotHeight + cardSpacingRowMM);

  const size = getPageSizeMM(pageSize, pageWidth, pageHeight);
  const lengthMM = Math.max(size.width, size.height);

  const containerWidth = calculateCardContainerWidth(
    size.width,
    bleedEdgeMM,
    cardSpacingColMM,
    pageMarginLeftMM,
    pageMarginRightMM
  );
  const cardsPerRow = getCardsPerRow(
    containerWidth,
    bleedEdgeMM,
    cardSpacingColMM
  );

  const containerHeight = calculateCardContainerHeight(
    size.height,
    bleedEdgeMM,
    cardSpacingRowMM,
    pageMarginTopMM,
    pageMarginBottomMM
  );
  const cardsPerCol = getCardsPerCol(
    containerHeight,
    bleedEdgeMM,
    cardSpacingRowMM
  );

  return (
    <View
      style={{
        position: "absolute" as const,
        left: left + "mm",
        top: top + "mm",
        width: cardSlotWidth + "mm",
        height: cardSlotHeight + "mm",
      }}
    >
      <CutLineCorner
        position="top-left"
        lengthMM={cutLineLengthMM}
        placement="Inside"
        shape="Cross"
        {...(colIndex === 0 && { horizontalLeftLengthOverrideMM: lengthMM })}
        {...(rowIndex === 0 && { verticalUpLengthOverrideMM: lengthMM })}
      />
      <CutLineCorner
        position="top-right"
        lengthMM={cutLineLengthMM}
        placement="Inside"
        shape="Cross"
        {...(colIndex === cardsPerRow - 1 && {
          horizontalRightLengthOverrideMM: lengthMM,
        })}
        {...(rowIndex === 0 && { verticalUpLengthOverrideMM: lengthMM })}
      />
      <CutLineCorner
        position="bottom-left"
        lengthMM={cutLineLengthMM}
        placement="Inside"
        shape="Cross"
        {...(colIndex === 0 && { horizontalLeftLengthOverrideMM: lengthMM })}
        {...(rowIndex === cardsPerCol - 1 && {
          verticalDownLengthOverrideMM: lengthMM,
        })}
      />
      <CutLineCorner
        position="bottom-right"
        lengthMM={cutLineLengthMM}
        placement="Inside"
        shape="Cross"
        {...(colIndex === cardsPerRow - 1 && {
          horizontalRightLengthOverrideMM: lengthMM,
        })}
        {...(rowIndex === cardsPerCol - 1 && {
          verticalDownLengthOverrideMM: lengthMM,
        })}
      />
    </View>
  );
};

const CardGrid = ({
  pageWidthMM,
  pageHeightMM,
  cardDocuments,
}: {
  pageWidthMM: number;
  pageHeightMM: number;
  cardDocuments: (CardDocument | undefined)[];
}) => {
  const {
    bleedEdgeMM,
    drawCardCutLines,
    drawPageCutLines,
    cardSpacingRowMM,
    cardSpacingColMM,
    pageMarginLeftMM,
    pageMarginRightMM,
    pageMarginTopMM,
    pageMarginBottomMM,
  } = usePDFContext();

  const containerWidth = calculateCardContainerWidth(
    pageWidthMM,
    bleedEdgeMM,
    cardSpacingColMM,
    pageMarginLeftMM,
    pageMarginRightMM
  );

  const cardsPerRow = getCardsPerRow(
    containerWidth,
    bleedEdgeMM,
    cardSpacingColMM
  );

  const containerHeight = calculateCardContainerHeight(
    pageHeightMM,
    bleedEdgeMM,
    cardSpacingRowMM,
    pageMarginTopMM,
    pageMarginBottomMM
  );
  const cardsPerCol = getCardsPerCol(
    containerHeight,
    bleedEdgeMM,
    cardSpacingRowMM
  );

  return (
    <View
      style={{
        width: containerWidth + "mm",
        height: containerHeight + "mm",
        alignSelf: "center",
        position: "relative" as const,
      }}
    >
      {/* Pass 0: page cut-line underlay — painted before all images so it is always on bottom */}
      {drawPageCutLines && (
        <View
          style={{
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: containerWidth + "mm",
            height: containerHeight + "mm",
          }}
        >
          {Array(cardsPerCol)
            .keys()
            .toArray()
            .flatMap((rowIndex) =>
              Array(cardsPerRow)
                .keys()
                .toArray()
                .map((colIndex) => (
                  <PageCutLines
                    key={`cutlines-${rowIndex}-${colIndex}`}
                    colIndex={colIndex}
                    rowIndex={rowIndex}
                  />
                ))
            )}
        </View>
      )}

      {/* Pass 1: all card images laid out in a flex-wrap row */}
      <View
        style={{
          ...styles.section,
          width: containerWidth + "mm",
          rowGap: cardSpacingRowMM + "mm",
          columnGap: cardSpacingColMM + "mm",
        }}
      >
        {cardDocuments.map((doc, i) =>
          doc ? (
            <PDFCardImage key={`img-${i}`} cardDocument={doc} />
          ) : (
            // Empty placeholder keeps flex positions consistent for slots
            // where a card document is missing.
            <View
              key={`placeholder-${i}`}
              style={{
                width: CardWidthMM + 2 * bleedEdgeMM + "mm",
                minWidth: CardWidthMM + 2 * bleedEdgeMM + "mm",
                height: CardHeightMM + 2 * bleedEdgeMM + "mm",
                minHeight: CardHeightMM + 2 * bleedEdgeMM + "mm",
              }}
            />
          )
        )}
      </View>

      {/* Pass 2: card cut-line overlay — painted after all images so it is always on top */}
      {drawCardCutLines && (
        <View
          style={{
            position: "absolute" as const,
            top: 0,
            left: 0,
            width: containerWidth + "mm",
            height: containerHeight + "mm",
          }}
        >
          {cardDocuments.map((_, i) => {
            const colIndex = i % cardsPerRow;
            const rowIndex = Math.floor(i / cardsPerRow);
            return (
              <PDFCardCutLines
                key={`cutlines-${i}`}
                colIndex={colIndex}
                rowIndex={rowIndex}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const chunk = <T,>(arr: Array<T>, size: number): Array<Array<T>> => {
  const result: Array<Array<T>> = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const paginateFrontsAndDistinctBacks = (
  projectMembers: Array<SlotProjectMembers>,
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument },
  projectCardback: string | undefined,
  cardsPerPage: number
): Array<Array<CardDocument>> => [
  projectMembers.flatMap((member) => {
    const front =
      member.front?.selectedImage !== undefined
        ? cardDocumentsByIdentifier[member.front.selectedImage]
        : undefined;
    const back =
      member.back?.selectedImage !== undefined &&
      member.back.selectedImage !== projectCardback
        ? cardDocumentsByIdentifier[member.back.selectedImage]
        : undefined;
    return [front, back].filter((d): d is CardDocument => d !== undefined);
  }),
];

const paginateFrontsOnly = (
  projectMembers: Array<SlotProjectMembers>,
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument },
  projectCardback: string | undefined,
  cardsPerPage: number
): Array<Array<CardDocument>> => [
  projectMembers
    .map((member) =>
      member.front?.selectedImage !== undefined
        ? cardDocumentsByIdentifier[member.front.selectedImage]
        : undefined
    )
    .filter((d): d is CardDocument => d !== undefined),
];

const paginateBacksOnly = (
  projectMembers: Array<SlotProjectMembers>,
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument },
  projectCardback: string | undefined,
  cardsPerPage: number
): Array<Array<CardDocument>> => [
  projectMembers
    .map((member) =>
      member.back?.selectedImage !== undefined
        ? cardDocumentsByIdentifier[member.back.selectedImage]
        : undefined
    )
    .filter((d): d is CardDocument => d !== undefined),
];

const paginateFrontsAndBacks = (
  projectMembers: Array<SlotProjectMembers>,
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument },
  projectCardback: string | undefined,
  cardsPerPage: number
): Array<Array<CardDocument>> => {
  const fronts = paginateFrontsOnly(
    projectMembers,
    cardDocumentsByIdentifier,
    projectCardback,
    cardsPerPage
  )[0];
  const backs = paginateBacksOnly(
    projectMembers,
    cardDocumentsByIdentifier,
    projectCardback,
    cardsPerPage
  )[0];
  const frontPages = chunk(fronts, cardsPerPage);
  const backPages = chunk(backs, cardsPerPage);
  const maxPages = Math.max(frontPages.length, backPages.length);
  return Array.from({ length: maxPages }, (_, i) =>
    [frontPages[i], backPages[i]].filter(
      (page): page is Array<CardDocument> => page !== undefined
    )
  ).flat();
};

const CardSelectionModeToPaginator: {
  [cardSelectionMode in keyof typeof CardSelectionMode]: (
    projectMembers: Array<SlotProjectMembers>,
    cardDocumentsByIdentifier: { [identifier: string]: CardDocument },
    projectCardback: string | undefined,
    cardsPerPage: number
  ) => Array<Array<CardDocument>>;
} = {
  frontsAndDistinctBacks: paginateFrontsAndDistinctBacks,
  frontsOnly: paginateFrontsOnly,
  backsOnly: paginateBacksOnly,
  frontsAndBacks: paginateFrontsAndBacks,
};

export const PDF = (props: PDFProps) => {
  if (props.scmMode) {
    return (
      <SCMPDF
        scmPaperSize={props.scmPaperSize}
        scmVariant={props.scmVariant}
        scmRegistration={props.scmRegistration}
        scmDuplex={props.scmDuplex}
        scmOffsetXMM={props.scmOffsetXMM}
        scmOffsetYMM={props.scmOffsetYMM}
        scmOffsetAngleDeg={props.scmOffsetAngleDeg}
        cardDocumentsByIdentifier={props.cardDocumentsByIdentifier}
        projectMembers={props.projectMembers}
        projectCardback={props.projectCardback}
        imageQuality={props.imageQuality}
        imageDPI={props.imageDPI}
        jpgQuality={props.jpgQuality}
        fileHandles={props.fileHandles}
      />
    );
  }

  const size = getPageSizeMM(props.pageSize, props.pageWidth, props.pageHeight);

  const containerWidth = calculateCardContainerWidth(
    size.width,
    props.bleedEdgeMM,
    props.cardSpacingColMM,
    props.pageMarginLeftMM,
    props.pageMarginRightMM
  );
  const containerHeight = calculateCardContainerHeight(
    size.height,
    props.bleedEdgeMM,
    props.cardSpacingRowMM,
    props.pageMarginTopMM,
    props.pageMarginBottomMM
  );
  const cardsPerPage =
    getCardsPerRow(containerWidth, props.bleedEdgeMM, props.cardSpacingColMM) *
    getCardsPerCol(containerHeight, props.bleedEdgeMM, props.cardSpacingRowMM);

  const cardDocumentSets = CardSelectionModeToPaginator[
    props.cardSelectionMode
  ](
    props.projectMembers,
    props.cardDocumentsByIdentifier,
    props.projectCardback,
    cardsPerPage
  );
  const pages = cardDocumentSets.flatMap((set) => chunk(set, cardsPerPage));

  return (
    <PDFContext.Provider value={props}>
      <Document pageMode="useThumbs">
        {(pages.length > 0 ? pages : [[]]).map((pageCards, i) => (
          <Page
            key={i}
            size={{ width: size.width + "mm", height: size.height + "mm" }}
            style={{
              paddingTop: props.pageMarginTopMM + "mm",
              paddingBottom: props.pageMarginBottomMM + "mm",
              paddingLeft: props.pageMarginLeftMM + "mm",
              paddingRight: props.pageMarginRightMM + "mm",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <CardGrid
              pageWidthMM={size.width}
              pageHeightMM={size.height}
              cardDocuments={pageCards}
            />
          </Page>
        ))}
      </Document>
    </PDFContext.Provider>
  );
};
