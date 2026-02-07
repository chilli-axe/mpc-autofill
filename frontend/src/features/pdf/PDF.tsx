import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React from "react";

import { GoogleDriveImageAPIURL } from "@/common/constants";
import {
  BleedEdgeMM,
  CardHeightMM,
  CardWidthMM,
  CornerRadiusMM,
} from "@/common/constants";
import { getBucketThumbnailURL, getWorkerFullResURL } from "@/common/image";
import { base64StringToBlob } from "@/common/processing";
import { SourceType } from "@/common/schema_types";
import { CardDocument, SlotProjectMembers } from "@/common/types";

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
});

export interface PDFProps {
  cardSelectionMode: keyof typeof CardSelectionMode;
  pageSize: keyof typeof PageSize;
  bleedEdgeMM: number;
  roundCorners: boolean;
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
  bleedEdgeMM: number;
  roundCorners: boolean;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  fileHandles: { [identifier: string]: FileSystemFileHandle };
}

const PDFCardThumbnail = ({
  cardDocument,
  bleedEdgeMM,
  roundCorners,
  imageQuality,
  fileHandles,
}: PDFCardThumbnailProps) => {
  const height = CardHeightMM + 2 * bleedEdgeMM;
  const heightProportion = (CardHeightMM + 2 * BleedEdgeMM) / height;
  const width = CardWidthMM + 2 * bleedEdgeMM;
  const widthProportion = (CardWidthMM + 2 * BleedEdgeMM) / width;
  const style = {
    width: width + "mm",
    minWidth: width + "mm",
    height: height + "mm",
    minHeight: height + "mm",
    transform: `scale(${widthProportion}, ${heightProportion})`,
    overflow: "hidden",
    borderRadius: (roundCorners ? CornerRadiusMM : 0) + "mm",
  } as const;
  return (
    <>
      <Image
        src={async () =>
          getThumbnailURL(cardDocument, imageQuality, fileHandles)
        }
        style={style}
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
  bleedEdgeMM,
  roundCorners,
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
                    bleedEdgeMM={bleedEdgeMM}
                    roundCorners={roundCorners}
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
                    bleedEdgeMM={bleedEdgeMM}
                    roundCorners={roundCorners}
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
