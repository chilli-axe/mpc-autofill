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
    justifyContent: "center",
  },
});

export interface PDFProps {
  cardSelectionMode: keyof typeof CardSelectionMode;
  pageSize: keyof typeof PageSize;
  pageWidth: number | undefined;
  pageHeight: number | undefined;
  bleedEdgeMM: number;
  roundCorners: boolean;
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

type CardPageProps = Pick<
  PDFProps,
  | "projectMembers"
  | "cardDocumentsByIdentifier"
  | "projectCardback"
  | "bleedEdgeMM"
  | "roundCorners"
  | "imageQuality"
  | "fileHandles"
> & { cardSpacingRowMM: number; cardSpacingColMM: number; pageBreak?: boolean };

const FrontsAndDistinctBacksPage = ({
  projectMembers,
  cardDocumentsByIdentifier,
  projectCardback,
  bleedEdgeMM,
  roundCorners,
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={{
        ...styles.section,
        rowGap: cardSpacingRowMM + "mm",
        columnGap: cardSpacingColMM + "mm",
      }}
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
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={{
        ...styles.section,
        rowGap: cardSpacingRowMM + "mm",
        columnGap: cardSpacingColMM + "mm",
      }}
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
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
  pageBreak,
}: CardPageProps) => {
  return (
    <View
      break={pageBreak}
      style={{
        ...styles.section,
        rowGap: cardSpacingRowMM + "mm",
        columnGap: cardSpacingColMM + "mm",
      }}
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
  imageQuality,
  fileHandles,
  cardSpacingRowMM,
  cardSpacingColMM,
}: CardPageProps) => {
  return (
    <>
      <FrontsOnlyPage
        projectMembers={projectMembers}
        cardDocumentsByIdentifier={cardDocumentsByIdentifier}
        projectCardback={projectCardback}
        bleedEdgeMM={bleedEdgeMM}
        roundCorners={roundCorners}
        imageQuality={imageQuality}
        fileHandles={fileHandles}
        cardSpacingRowMM={cardSpacingRowMM}
        cardSpacingColMM={cardSpacingColMM}
        pageBreak={false}
      />
      <BacksOnlyPage
        projectMembers={projectMembers}
        cardDocumentsByIdentifier={cardDocumentsByIdentifier}
        projectCardback={projectCardback}
        bleedEdgeMM={bleedEdgeMM}
        roundCorners={roundCorners}
        imageQuality={imageQuality}
        fileHandles={fileHandles}
        cardSpacingRowMM={cardSpacingRowMM}
        cardSpacingColMM={cardSpacingColMM}
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
  const size =
    pageSize === "CUSTOM" && pageWidth !== undefined && pageHeight !== undefined
      ? { width: pageWidth + "mm", height: pageHeight + "mm" }
      : (pageSize as keyof Omit<typeof PageSize, "CUSTOM">);
  const PageComponent = CardSelectionModeToPage[cardSelectionMode];
  return (
    <Document pageMode="useThumbs">
      <Page
        size={size}
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
          imageQuality={imageQuality}
          fileHandles={fileHandles}
          cardSpacingRowMM={cardSpacingRowMM}
          cardSpacingColMM={cardSpacingColMM}
        />
      </Page>
    </Document>
  );
};
