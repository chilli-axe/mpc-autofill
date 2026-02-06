import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React from "react";

import { GoogleDriveImageAPIURL } from "@/common/constants";
import { getBucketThumbnailURL, getWorkerFullResURL } from "@/common/image";
import { base64StringToBlob } from "@/common/processing";
import { SourceType } from "@/common/schema_types";
import { CardDocument, SlotProjectMembers } from "@/common/types";

export const BleedEdgeMode = {
  hideBleedEdgeWithRoundCorners: "Hide Bleed Edge, Round Corners",
  hideBleedEdge: "Hide Bleed Edge, Square Corners",
  showBleedEdge: "Include Bleed Edge",
} as const;

export const PageSize = {
  A4: "A4",
  A3: "A3",
  LETTER: "LETTER",
  LEGAL: "LEGAL",
  TABLOID: "TABLOID",
} as const;

export const CardSelectionMode = {
  frontsAndDistinctBacks: "Fronts + Distinct Backs",
  frontsOnly: "Fronts Only",
  frontsAndBacks: "Fronts + Backs",
  backsOnly: "Backs Only",
} as const;

const CardWidthMM = 63;
const CardHeightMM = 88;
const BleedEdgeMM = 0.12 * 2.54; // 72 pixels at 300 dpi -> 0.12 inches, convert to MM
const CornerRadiusMM = 2.5;

const ImageShowBleedStyle = {
  width: CardWidthMM + BleedEdgeMM + "mm",
  height: CardHeightMM + BleedEdgeMM + "mm",
  minWidth: CardWidthMM + BleedEdgeMM + "mm",
  minHeight: CardHeightMM + BleedEdgeMM + "mm",
} as const;
const ImageHideBleedSquareCornersStyle = {
  ...ImageShowBleedStyle,
  width: CardWidthMM + "mm",
  height: CardHeightMM + "mm",
  minWidth: CardWidthMM + "mm",
  minHeight: CardHeightMM + "mm",
  transform: "scale(1.088, 1.065)",
  overflow: "hidden",
} as const;
const ImageHideBleedRoundCornersStyle = {
  ...ImageHideBleedSquareCornersStyle,
  borderRadius: CornerRadiusMM + "mm",
} as const;

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  section: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imageShowBleed: ImageShowBleedStyle,
  imageHideBleedSquareCorners: ImageHideBleedSquareCornersStyle,
  imageHideBleedRoundCorners: ImageHideBleedRoundCornersStyle,
});

const BleedEdgeModeToStyle: {
  [bleedEdgeMode in keyof typeof BleedEdgeMode]: any;
} = {
  showBleedEdge: styles.imageShowBleed,
  hideBleedEdge: styles.imageHideBleedSquareCorners,
  hideBleedEdgeWithRoundCorners: styles.imageHideBleedRoundCorners,
};

export interface PDFProps {
  cardSelectionMode: keyof typeof CardSelectionMode;
  pageSize: keyof typeof PageSize;
  bleedEdgeMode: keyof typeof BleedEdgeMode;
  cardSpacingMM: number;
  marginMM: number;
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
  bleedEdgeMode: keyof typeof BleedEdgeMode;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const PDFCardThumbnail = ({
  cardDocument,
  bleedEdgeMode,
  imageQuality,
  fileHandles,
}: PDFCardThumbnailProps) => {
  const bleedEdgeModeStyle = BleedEdgeModeToStyle[bleedEdgeMode];
  return (
    <>
      <Image
        src={async () =>
          getThumbnailURL(cardDocument, imageQuality, fileHandles)
        }
        style={bleedEdgeModeStyle}
      />
    </>
  );
};

const includeFront = (
  cardSelectionMode: keyof typeof CardSelectionMode
): boolean => cardSelectionMode !== "backsOnly";
const includeBack = (
  identifier: string,
  projectCardback: string | undefined,
  cardSelectionMode: keyof typeof CardSelectionMode
): boolean =>
  cardSelectionMode === "frontsAndBacks" ||
  cardSelectionMode === "backsOnly" ||
  (cardSelectionMode === "frontsAndDistinctBacks" &&
    identifier !== projectCardback);

export const PDF = ({
  cardSelectionMode,
  pageSize,
  bleedEdgeMode,
  cardSpacingMM,
  marginMM,
  projectMembers,
  projectCardback,
  cardDocumentsByIdentifier,
  imageQuality,
  fileHandles,
}: PDFProps) => {
  return (
    <Document>
      <Page size={pageSize} style={{ ...styles.page, margin: marginMM + "mm" }}>
        <View style={{ ...styles.section, gap: cardSpacingMM + "mm" }}>
          {projectMembers.map((member, i) => (
            <>
              {member.front?.selectedImage !== undefined &&
                cardDocumentsByIdentifier[member.front.selectedImage] !==
                  undefined &&
                includeFront(cardSelectionMode) && (
                  <PDFCardThumbnail
                    key={`${i}-front`}
                    cardDocument={
                      cardDocumentsByIdentifier[member.front.selectedImage]
                    }
                    bleedEdgeMode={bleedEdgeMode}
                    imageQuality={imageQuality}
                    fileHandles={fileHandles}
                  />
                )}
              {member.back?.selectedImage !== undefined &&
                cardDocumentsByIdentifier[member.back.selectedImage] !==
                  undefined &&
                includeBack(
                  member.back.selectedImage,
                  projectCardback,
                  cardSelectionMode
                ) && (
                  <PDFCardThumbnail
                    key={`${i}-back`}
                    cardDocument={
                      cardDocumentsByIdentifier[member.back.selectedImage]
                    }
                    bleedEdgeMode={bleedEdgeMode}
                    imageQuality={imageQuality}
                    fileHandles={fileHandles}
                  />
                )}
            </>
          ))}
        </View>
      </Page>
    </Document>
  );
};
