import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React from "react";

import {
  BleedEdgeMM,
  CardHeightMM,
  CardWidthMM,
  CornerRadiusMM,
} from "@/common/constants";
import { getBucketThumbnailURL, getWorkerFullResURL } from "@/common/image";
import { SourceType } from "@/common/schema_types";
import { CardDocument, SlotProjectMembers } from "@/common/types";

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

const calculateCardContainerWidth = (
  pageWidthMM: number,
  bleedEdgeMM: number,
  cardSpacingColMM: number,
  pageMarginLeftMM: number,
  pageMarginRightMM: number
) => {
  const maxWidth = pageWidthMM - (pageMarginLeftMM + pageMarginRightMM);
  const calculateContainerWidth = (cardsFitted: number) =>
    // adding a small buffer of 0.1 mm as I observed some weird wrapping behaviour from react-pdf without this
    cardsFitted * (CardWidthMM + 2 * bleedEdgeMM) +
    (cardsFitted - 1) * cardSpacingColMM +
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

export const PageSize = {
  A4: "A4",
  A3: "A3",
  LETTER: "LETTER",
  LEGAL: "LEGAL",
  TABLOID: "TABLOID",
  CUSTOM: "Custom", // special case
} as const;

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
  pageSize: keyof typeof PageSize;
  pageWidth: number | undefined;
  pageHeight: number | undefined;
  bleedEdgeMM: number;
  roundCorners: boolean;
  drawCutLines: boolean;
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
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const getThumbnailURL = async (
  cardDocument: CardDocument,
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution",
  fileHandles: { [identifier: string]: FileSystemFileHandle }
): Promise<string | Blob | undefined> => {
  switch (cardDocument.sourceType) {
    case SourceType.GoogleDrive:
      switch (imageQuality) {
        case "small-thumbnail":
          return getBucketThumbnailURL(cardDocument, true);
        case "large-thumbnail":
          return getBucketThumbnailURL(cardDocument, false);
        case "full-resolution":
          return getWorkerFullResURL(cardDocument);
        default:
          throw new Error(`invalid imageQuality ${imageQuality}`);
      }

    case SourceType.LocalFile:
      const handle = fileHandles[cardDocument.identifier];
      if (handle !== undefined) {
        return URL.createObjectURL(await handle.getFile());
      } else {
        throw new Error(
          `could not get handle for file ${cardDocument.identifier}`
        );
      }
    default:
      throw new Error(
        `cannot get PDF thumbnail URL for card ${cardDocument.identifier}`
      );
  }
};

interface PDFCardThumbnailProps {
  cardDocument: CardDocument;
  bleedEdgeMM: number;
  roundCorners: boolean;
  drawCutLines: boolean;
  cutLineLengthMM: number;
  cutLineOffsetMM: number;
  cutLineThicknessMM: number;
  cutLineColor: string;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const PDFCardThumbnail = ({
  cardDocument,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  imageQuality,
  fileHandles,
}: PDFCardThumbnailProps) => {
  const height = CardHeightMM + 2 * bleedEdgeMM;
  const heightProportion = (CardHeightMM + 2 * BleedEdgeMM) / height;
  const width = CardWidthMM + 2 * bleedEdgeMM;
  const widthProportion = (CardWidthMM + 2 * BleedEdgeMM) / width;
  const radius = roundCorners ? CornerRadiusMM : 0;
  const imageStyle = {
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
  } as const;

  // Corner marks are positioned so their inner corner aligns with the card boundary
  // (i.e. inset by bleedEdgeMM from each container edge). The mark extends outward
  // into the bleed area by cutLineLengthMM.
  const markOffset = bleedEdgeMM - cutLineOffsetMM + "mm";
  const markSize = cutLineLengthMM + "mm";
  const markThickness = cutLineThicknessMM + "mm";

  const baseMarkStyle = {
    position: "absolute" as const,
    width: markSize,
    height: markSize,
  };
  const topBorder = {
    borderTopWidth: markThickness,
    borderTopStyle: "solid" as const,
    borderTopColor: cutLineColor,
  };
  const bottomBorder = {
    borderBottomWidth: markThickness,
    borderBottomStyle: "solid" as const,
    borderBottomColor: cutLineColor,
  };
  const leftBorder = {
    borderLeftWidth: markThickness,
    borderLeftStyle: "solid" as const,
    borderLeftColor: cutLineColor,
  };
  const rightBorder = {
    borderRightWidth: markThickness,
    borderRightStyle: "solid" as const,
    borderRightColor: cutLineColor,
  };

  return (
    <View
      style={{
        width: width + "mm",
        minWidth: width + "mm",
        height: height + "mm",
        minHeight: height + "mm",
        position: "relative",
      }}
    >
      <Image
        src={async () =>
          getThumbnailURL(cardDocument, imageQuality, fileHandles)
        }
        style={imageStyle}
      />
      {drawCutLines && (
        <>
          <View
            style={{
              ...baseMarkStyle,
              top: markOffset,
              left: markOffset,
              ...topBorder,
              ...leftBorder,
            }}
          />
          <View
            style={{
              ...baseMarkStyle,
              top: markOffset,
              right: markOffset,
              ...topBorder,
              ...rightBorder,
            }}
          />
          <View
            style={{
              ...baseMarkStyle,
              bottom: markOffset,
              left: markOffset,
              ...bottomBorder,
              ...leftBorder,
            }}
          />
          <View
            style={{
              ...baseMarkStyle,
              bottom: markOffset,
              right: markOffset,
              ...bottomBorder,
              ...rightBorder,
            }}
          />
        </>
      )}
    </View>
  );
};

const getPageStyle = (
  pageWidthMM: number,
  bleedEdgeMM: number,
  cardSpacingRowMM: number,
  cardSpacingColMM: number,
  pageMarginLeftMM: number,
  pageMarginRightMM: number
) =>
  ({
    ...styles.section,
    width:
      calculateCardContainerWidth(
        pageWidthMM,
        bleedEdgeMM,
        cardSpacingColMM,
        pageMarginLeftMM,
        pageMarginRightMM
      ) + "mm",
    rowGap: cardSpacingRowMM + "mm",
    columnGap: cardSpacingColMM + "mm",
    alignSelf: "center",
  } as const);

type CardPageProps = Pick<
  PDFProps,
  | "projectMembers"
  | "cardDocumentsByIdentifier"
  | "projectCardback"
  | "bleedEdgeMM"
  | "roundCorners"
  | "drawCutLines"
  | "cutLineLengthMM"
  | "cutLineOffsetMM"
  | "cutLineThicknessMM"
  | "cutLineColor"
  | "imageQuality"
  | "fileHandles"
  | "pageMarginLeftMM"
  | "pageMarginRightMM"
> & {
  pageWidthMM: number;
  pageHeightMM: number;
  cardSpacingRowMM: number;
  cardSpacingColMM: number;
  pageBreak?: boolean;
};

const FrontsAndDistinctBacksPage = ({
  projectMembers,
  cardDocumentsByIdentifier,
  projectCardback,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageWidthMM,
  pageMarginLeftMM,
  pageMarginRightMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={getPageStyle(
        pageWidthMM,
        bleedEdgeMM,
        cardSpacingRowMM,
        cardSpacingColMM,
        pageMarginLeftMM,
        pageMarginRightMM
      )}
    >
      {projectMembers.map((member, i) => (
        <>
          {member.front?.selectedImage !== undefined &&
            cardDocumentsByIdentifier[member.front.selectedImage] !==
              undefined && (
              <PDFCardThumbnail
                key={`${i}-front`}
                cardDocument={
                  cardDocumentsByIdentifier[member.front.selectedImage]
                }
                bleedEdgeMM={bleedEdgeMM}
                roundCorners={roundCorners}
                drawCutLines={drawCutLines}
                cutLineLengthMM={cutLineLengthMM}
                cutLineOffsetMM={cutLineOffsetMM}
                cutLineThicknessMM={cutLineThicknessMM}
                cutLineColor={cutLineColor}
                imageQuality={imageQuality}
                fileHandles={fileHandles}
              />
            )}
          {member.back?.selectedImage !== undefined &&
            cardDocumentsByIdentifier[member.back.selectedImage] !==
              undefined &&
            member.back.selectedImage !== projectCardback && (
              <PDFCardThumbnail
                key={`${i}-back`}
                cardDocument={
                  cardDocumentsByIdentifier[member.back.selectedImage]
                }
                bleedEdgeMM={bleedEdgeMM}
                roundCorners={roundCorners}
                drawCutLines={drawCutLines}
                cutLineLengthMM={cutLineLengthMM}
                cutLineOffsetMM={cutLineOffsetMM}
                cutLineThicknessMM={cutLineThicknessMM}
                cutLineColor={cutLineColor}
                imageQuality={imageQuality}
                fileHandles={fileHandles}
              />
            )}
        </>
      ))}
    </View>
  );
};

const FrontsOnlyPage = ({
  projectMembers,
  cardDocumentsByIdentifier,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageWidthMM,
  pageMarginLeftMM,
  pageMarginRightMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={getPageStyle(
        pageWidthMM,
        bleedEdgeMM,
        cardSpacingRowMM,
        cardSpacingColMM,
        pageMarginLeftMM,
        pageMarginRightMM
      )}
    >
      {projectMembers.map((member, i) => (
        <>
          {member.front?.selectedImage !== undefined &&
            cardDocumentsByIdentifier[member.front.selectedImage] !==
              undefined && (
              <PDFCardThumbnail
                key={`${i}-front`}
                cardDocument={
                  cardDocumentsByIdentifier[member.front.selectedImage]
                }
                bleedEdgeMM={bleedEdgeMM}
                roundCorners={roundCorners}
                drawCutLines={drawCutLines}
                cutLineLengthMM={cutLineLengthMM}
                cutLineOffsetMM={cutLineOffsetMM}
                cutLineThicknessMM={cutLineThicknessMM}
                cutLineColor={cutLineColor}
                imageQuality={imageQuality}
                fileHandles={fileHandles}
              />
            )}
        </>
      ))}
    </View>
  );
};

const BacksOnlyPage = ({
  projectMembers,
  cardDocumentsByIdentifier,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageWidthMM,
  pageMarginLeftMM,
  pageMarginRightMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={getPageStyle(
        pageWidthMM,
        bleedEdgeMM,
        cardSpacingRowMM,
        cardSpacingColMM,
        pageMarginLeftMM,
        pageMarginRightMM
      )}
    >
      {projectMembers.map((member, i) => (
        <>
          {member.back?.selectedImage !== undefined &&
            cardDocumentsByIdentifier[member.back.selectedImage] !==
              undefined && (
              <PDFCardThumbnail
                key={`${i}-front`}
                cardDocument={
                  cardDocumentsByIdentifier[member.back.selectedImage]
                }
                bleedEdgeMM={bleedEdgeMM}
                roundCorners={roundCorners}
                drawCutLines={drawCutLines}
                cutLineLengthMM={cutLineLengthMM}
                cutLineOffsetMM={cutLineOffsetMM}
                cutLineThicknessMM={cutLineThicknessMM}
                cutLineColor={cutLineColor}
                imageQuality={imageQuality}
                fileHandles={fileHandles}
              />
            )}
        </>
      ))}
    </View>
  );
};

const FrontsAndBacksPage = ({
  projectMembers,
  cardDocumentsByIdentifier,
  projectCardback,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageWidthMM,
  pageHeightMM,
  pageMarginLeftMM,
  pageMarginRightMM,
}: CardPageProps) => {
  return (
    <>
      <FrontsOnlyPage
        projectMembers={projectMembers}
        cardDocumentsByIdentifier={cardDocumentsByIdentifier}
        projectCardback={projectCardback}
        bleedEdgeMM={bleedEdgeMM}
        roundCorners={roundCorners}
        drawCutLines={drawCutLines}
        cutLineLengthMM={cutLineLengthMM}
        cutLineOffsetMM={cutLineOffsetMM}
        cutLineThicknessMM={cutLineThicknessMM}
        cutLineColor={cutLineColor}
        imageQuality={imageQuality}
        fileHandles={fileHandles}
        cardSpacingRowMM={cardSpacingRowMM}
        cardSpacingColMM={cardSpacingColMM}
        pageWidthMM={pageWidthMM}
        pageHeightMM={pageHeightMM}
        pageMarginLeftMM={pageMarginLeftMM}
        pageMarginRightMM={pageMarginRightMM}
        pageBreak={false}
      />
      <BacksOnlyPage
        projectMembers={projectMembers}
        cardDocumentsByIdentifier={cardDocumentsByIdentifier}
        projectCardback={projectCardback}
        bleedEdgeMM={bleedEdgeMM}
        roundCorners={roundCorners}
        drawCutLines={drawCutLines}
        cutLineLengthMM={cutLineLengthMM}
        cutLineOffsetMM={cutLineOffsetMM}
        cutLineThicknessMM={cutLineThicknessMM}
        cutLineColor={cutLineColor}
        imageQuality={imageQuality}
        fileHandles={fileHandles}
        cardSpacingRowMM={cardSpacingRowMM}
        cardSpacingColMM={cardSpacingColMM}
        pageWidthMM={pageWidthMM}
        pageHeightMM={pageHeightMM}
        pageMarginLeftMM={pageMarginLeftMM}
        pageMarginRightMM={pageMarginRightMM}
        pageBreak={true}
      />
    </>
  );
};

const CardSelectionModeToPage: {
  [cardSelectionMode in keyof typeof CardSelectionMode]: React.FC<CardPageProps>;
} = {
  frontsAndDistinctBacks: FrontsAndDistinctBacksPage,
  frontsOnly: FrontsOnlyPage,
  backsOnly: BacksOnlyPage,
  frontsAndBacks: FrontsAndBacksPage,
};

export const PDF = ({
  cardSelectionMode,
  pageSize,
  pageWidth,
  pageHeight,
  bleedEdgeMM,
  roundCorners,
  drawCutLines,
  cutLineLengthMM,
  cutLineOffsetMM,
  cutLineThicknessMM,
  cutLineColor,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageMarginTopMM,
  pageMarginBottomMM,
  pageMarginLeftMM,
  pageMarginRightMM,
  projectMembers,
  projectCardback,
  cardDocumentsByIdentifier,
  imageQuality,
  fileHandles,
}: PDFProps) => {
  const size = getPageSizeMM(pageSize, pageWidth, pageHeight);
  const PageComponent = CardSelectionModeToPage[cardSelectionMode];
  return (
    <Document pageMode="useThumbs">
      <Page
        size={{ width: size.width + "mm", height: size.height + "mm" }}
        style={{
          paddingTop: pageMarginTopMM + "mm",
          paddingBottom: pageMarginBottomMM + "mm",
          paddingLeft: pageMarginLeftMM + "mm",
          paddingRight: pageMarginRightMM + "mm",
        }}
      >
        <PageComponent
          projectMembers={projectMembers}
          cardDocumentsByIdentifier={cardDocumentsByIdentifier}
          projectCardback={projectCardback}
          bleedEdgeMM={bleedEdgeMM}
          roundCorners={roundCorners}
          drawCutLines={drawCutLines}
          cutLineLengthMM={cutLineLengthMM}
          cutLineOffsetMM={cutLineOffsetMM}
          cutLineThicknessMM={cutLineThicknessMM}
          cutLineColor={cutLineColor}
          imageQuality={imageQuality}
          fileHandles={fileHandles}
          cardSpacingRowMM={cardSpacingRowMM}
          cardSpacingColMM={cardSpacingColMM}
          pageMarginLeftMM={pageMarginLeftMM}
          pageMarginRightMM={pageMarginRightMM}
          pageWidthMM={size.width}
          pageHeightMM={size.height}
        />
      </Page>
    </Document>
  );
};
