import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React from "react";

import { GoogleDriveImageAPIURL } from "@/common/constants";
import { getBucketThumbnailURL, getWorkerFullResURL } from "@/common/image";
import { base64StringToBlob } from "@/common/processing";
import { SourceType } from "@/common/schema_types";
import { CardDocument, SlotProjectMembers } from "@/common/types";

export const BleedEdgeMode = {
  showBleedEdge: "Include Bleed Edge",
  hideBleedEdge: "Hide Bleed Edge, Square Corners",
  hideBleedEdgeWithRoundCorners: "Hide Bleed Edge, Round Corners",
} as const;

export const PageSize = {
  A4: "A4",
  A3: "A3",
  LETTER: "LETTER",
  LEGAL: "LEGAL",
  TABLOID: "TABLOID",
} as const;

const CardWidthInches = 2.5;
const CardHeightInches = 3.5;
const BleedEdgeInches = 0.25;
const CornerRadiusMM = 2.5;

const ImageShowBleedStyle = {
  width: CardWidthInches + BleedEdgeInches + "in",
  height: CardHeightInches + BleedEdgeInches + "in",
  minWidth: CardWidthInches + BleedEdgeInches + "in",
  minHeight: CardHeightInches + BleedEdgeInches + "in",
} as const;
const ImageHideBleedSquareCornersStyle = {
  ...ImageShowBleedStyle,
  width: CardWidthInches + "in",
  height: CardHeightInches + "in",
  minWidth: CardWidthInches + "in",
  minHeight: CardHeightInches + "in",
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
  pageSize: keyof typeof PageSize;
  bleedEdgeMode: keyof typeof BleedEdgeMode;
  includeCutLines: boolean;
  cardSpacingMM: number;
  marginMM: number;
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument };
  projectMembers: Array<SlotProjectMembers>;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  dpi: number;
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const getThumbnailURL = async (
  cardDocument: CardDocument,
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution",
  fileHandles: { [identifier: string]: FileSystemFileHandle },
  dpi: number
): Promise<string | Blob | undefined> => {
  switch (cardDocument.sourceType) {
    case SourceType.GoogleDrive:
      switch (imageQuality) {
        case "small-thumbnail":
          return getBucketThumbnailURL(cardDocument, true);
        case "large-thumbnail":
          return getBucketThumbnailURL(cardDocument, false);
        case "full-resolution":
          return getWorkerFullResURL(cardDocument, dpi, "high");
        // return fetch(GoogleDriveImageAPIURL + "?" + new URLSearchParams({ id: cardDocument.identifier }).toString()).then(response => response.text().then(base64StringToBlob));
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
  dpi: number;
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const PDFCardThumbnail = ({
  cardDocument,
  bleedEdgeMode,
  imageQuality,
  fileHandles,
  dpi,
}: PDFCardThumbnailProps) => {
  const bleedEdgeModeStyle = BleedEdgeModeToStyle[bleedEdgeMode];
  return (
    <Image
      src={async () =>
        getThumbnailURL(cardDocument, imageQuality, fileHandles, dpi)
      }
      style={bleedEdgeModeStyle}
    />
  );
};

export const PDF = ({
  pageSize,
  includeCutLines,
  bleedEdgeMode,
  cardSpacingMM,
  marginMM,
  projectMembers,
  cardDocumentsByIdentifier,
  imageQuality,
  dpi,
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
                  undefined && (
                  <PDFCardThumbnail
                    key={`${i}-front`}
                    cardDocument={
                      cardDocumentsByIdentifier[member.front.selectedImage]
                    }
                    bleedEdgeMode={bleedEdgeMode}
                    imageQuality={imageQuality}
                    dpi={dpi}
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
