import { Document, Image, Page, StyleSheet, View } from "@react-pdf/renderer";
import React from "react";

import { GoogleDriveImageAPIURL } from "@/common/constants";
import { getBucketThumbnailURL, getWorkerFullResURL } from "@/common/image";
import { base64StringToBlob } from "@/common/processing";
import { SourceType } from "@/common/schema_types";
import { CardDocument, SlotProjectMembers } from "@/common/types";

import { ClientSearchService } from "../clientSearch/clientSearchService";

export enum BleedEdgeMode {
  showBleedEdge = "Include Bleed Edge",
  hideBleedEdge = "Hide Bleed Edge, Square Corners",
  hideBleedEdgeWithRoundCorners = "Hide Bleed Edge, Round Corners",
}

export enum PageSize {
  A4 = "A4",
  A3 = "A3",
  LETTER = "LETTER",
  LEGAL = "LEGAL",
  TABLOID = "TABLOID",
}

const ImageShowBleedStyle = {
  // width: 63.5 + "mm",
  // height: 88.9 + "mm",
  width: 2.5 + 0.25 + "in",
  height: 3.5 + 0.25 + "in",
  minWidth: 2.5 + 0.25 + "in",
  minHeight: 3.5 + 0.25 + "in",
  // maxWidth: (2.5 + 0.25) + "in",
  // maxHeight: (3.5 + 0.25) + "in",
};
const ImageHideBleedSquareCornersStyle = {
  ...ImageShowBleedStyle,
  width: 2.5 + "in",
  height: 3.5 + "in",
  minWidth: 2.5 + "in",
  minHeight: 3.5 + "in",
  transform: "scale(1.088, 1.065)",
  overflow: "hidden",
};
const ImageHideBleedRoundCornersStyle = {
  ...ImageHideBleedSquareCornersStyle,
  borderRadius: 2.5 + "mm",
};

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    flexWrap: "wrap",

    // backgroundColor: "#EEEEEE",
  },
  section: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imageShowBleed: ImageShowBleedStyle,
  imageHideBleedSquareCorners: ImageHideBleedSquareCornersStyle,
  imageHideBleedRoundCorners: ImageHideBleedRoundCornersStyle,
});

const BleedEdgeModeToStyle: { [bleedEdgeMode in BleedEdgeMode]: any } = {
  [BleedEdgeMode.showBleedEdge]: styles.imageShowBleed,
  [BleedEdgeMode.hideBleedEdge]: styles.imageHideBleedSquareCorners,
  [BleedEdgeMode.hideBleedEdgeWithRoundCorners]:
    styles.imageHideBleedRoundCorners,
};

export interface PDFProps {
  pageSize: PageSize;
  bleedEdgeMode: BleedEdgeMode;
  includeCutLines: boolean;
  cardSpacingMM: number;
  marginMM: number;
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument };
  projectMembers: Array<SlotProjectMembers>;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  dpi: number;
  //   clientSearchService: ClientSearchService;
}

const getThumbnailURL = async (
  cardDocument: CardDocument,
  // clientSearchService: ClientSearchService
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution",
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
      console.log("about to throw", cardDocument);
      throw new Error(
        `local files not supported for the moment. need to set up call to other worker here? ${cardDocument.sourceType}`
      );
    default:
      throw new Error(
        `cannot get PDF thumbnail URL for card ${cardDocument.identifier}`
      );
    //   const oramaCardDocument = await clientSearchService.getByID(
    //     cardDocument?.identifier
    //   );
    //   if (oramaCardDocument?.params?.sourceType == SourceType.LocalFile) {
    //     const file = await oramaCardDocument.params.fileHandle.getFile();
    //     return URL.createObjectURL(file);
    //   }
  }
};

interface PDFCardThumbnailProps {
  cardDocument: CardDocument;
  bleedEdgeMode: BleedEdgeMode;
  imageQuality: "small-thumbnail" | "large-thumbnail" | "full-resolution";
  dpi: number;
  //   clientSearchService: ClientSearchService
}

const PDFCardThumbnail = ({
  cardDocument,
  bleedEdgeMode,
  imageQuality,
  dpi,
}: //   clientSearchService
PDFCardThumbnailProps) => {
  const bleedEdgeModeStyle = BleedEdgeModeToStyle[bleedEdgeMode];
  return (
    <Image
      src={async () =>
        getThumbnailURL(
          cardDocument,
          // clientSearchService
          imageQuality,
          dpi
        )
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
}: //   clientSearchService,
PDFProps) => {
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
                    // clientSearchService={clientSearchService}
                    imageQuality={imageQuality}
                    dpi={dpi}
                  />
                )}
            </>
          ))}
        </View>
      </Page>
    </Document>
  );
};
