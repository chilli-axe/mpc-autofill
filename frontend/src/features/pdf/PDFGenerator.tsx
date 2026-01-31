import {
  Document,
  Image,
  Page,
  PDFViewer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { useMemo, useState } from "react";
import React from "react";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import {
  CardDocument,
  SlotProjectMembers,
  useAppSelector,
} from "@/common/types";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectProjectMembers } from "@/store/slices/projectSlice";

import { useImageSrc } from "../card/Card";

enum BleedEdgeMode {
  showBleedEdge = "Include Bleed Edge",
  hideBleedEdge = "Hide Bleed Edge, Square Corners",
  hideBleedEdgeWithRoundCorners = "Hide Bleed Edge, Round Corners",
}

enum PageSize {
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

interface PDFPreviewProps {
  pageSize: PageSizes;
  bleedEdgeMode: BleedEdgeMode;
  includeCutLines: boolean;
  cardSpacingMM: number;
  marginMM: number;
  cardDocumentsByIdentifier: { [identifier: string]: CardDocument };
}

// const PDFCardThumbnail = ({cardDocument}: {cardDocument: CardDocument}) => {
//   // const { imageSrc } = useImageSrc(cardDocument, true);

//   return <Image src={imageSrc} style={styles.image}/>
// }

function PDFDocument({
  pageSize,
  includeCutLines,
  bleedEdgeMode,
  cardSpacingMM,
  marginMM,
  projectMembers,
  cardDocumentsByIdentifier,
}: PDFPreviewProps & { projectMembers: Array<SlotProjectMembers> }) {
  const bleedEdgeModeStyle = BleedEdgeModeToStyle[bleedEdgeMode];
  return (
    <Document>
      <Page size={pageSize} style={{ ...styles.page, margin: marginMM + "mm" }}>
        <View style={{ ...styles.section, gap: cardSpacingMM + "mm" }}>
          {projectMembers.map((member) => (
            <>
              <Image
                src="https://img.mpcautofill.com/1lcXNFb6I86ugvhqSfPaA3HuwiCSj5wN8-small-google_drive"
                style={bleedEdgeModeStyle}
              />
              <Image
                src="https://img.mpcautofill.com/1sq1aY5cBUTaZ1-bqANSN8jQyjbbhh6uR-small-google_drive"
                style={bleedEdgeModeStyle}
              />
              <Image
                src="https://img.mpcautofill.com/1xTnSx8FhtZX1IV_OXUeorFaJS8iYwV45-small-google_drive"
                style={bleedEdgeModeStyle}
              />
              <Image
                src="https://img.mpcautofill.com/1PxWVhIhUA_HAlHkCvx3O5O_HAaZhzyES-small-google_drive"
                style={bleedEdgeModeStyle}
              />
              {/* <Image src={cardDocumentsByIdentifier[member.front.selectedImage].smallThumbnailUrl} style={styles.image} /> */}
              {/* <Text>{cardDocumentsByIdentifier[member.front.selectedImage].smallThumbnailUrl}</Text> */}
              {/* <PDFCardThumbnail cardDocument={cardDocumentsByIdentifier[member.front!.selectedImage!]} /> */}
            </>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function PDFPreview(props: PDFPreviewProps) {
  const projectMembers = useAppSelector(selectProjectMembers); // TODO: not in redux context?
  return (
    <PDFViewer width="100%" height="100%" showToolbar={false}>
      <PDFDocument {...props} projectMembers={projectMembers} />
    </PDFViewer>
  );
}

export function PDFGenerator() {
  // TODO: include fronts / include fronts and unique backs / include fronts and backs
  const [includeCutLines, setIncludeCutLines] = useState<boolean>(false);
  const [cardSpacingMM, setCardSpacingMM] = useState<number>(5);
  const [marginMM, setMarginMM] = useState<number>(5);

  const [pageSize, setPageSize] = useState<string>(PageSize.A4);
  const pageSizeOptions = useMemo(
    () =>
      Object.entries(PageSize).map(([value, label]) => ({
        value,
        label,
        checked: value === pageSize,
      })),
    [pageSize]
  );
  // TODO: types here are munted. probs stop using enum.
  const [bleedEdgeMode, setBleedEdgeMode] = useState<string>(
    "hideBleedEdgeWithRoundCorners"
  );
  const bleedEdgeModeOptions = useMemo(
    () =>
      Object.entries(BleedEdgeMode).map(([value, label]) => ({
        value,
        label,
        checked: value === bleedEdgeMode,
      })),
    [bleedEdgeMode]
  );

  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();

  return (
    <Container style={{ height: 100 + "%" }}>
      <Row style={{ height: 100 + "%" }}>
        <Col lg={5} className="mb-3 mb-lg-0">
          <Toggle
            onClick={() => setIncludeCutLines((value) => !value)}
            on="Include Cut Lines"
            onClassName="flex-centre"
            off="No Cut Lines"
            offClassName="flex-centre"
            onstyle="primary"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={ToggleButtonHeight + "px"}
            active={includeCutLines}
          />
          <br />
          <Row>
            <Col xs={6}>
              <Form.Label>Select page size</Form.Label>
              <StyledDropdownTreeSelect
                data={pageSizeOptions}
                onChange={(currentNode, selectedNodes) =>
                  setPageSize(currentNode.value)
                }
                mode="radioSelect"
                inlineSearchInput
              />
            </Col>
            <Col xs={6}>
              <Form.Label>Configure bleed edge</Form.Label>
              <StyledDropdownTreeSelect
                data={bleedEdgeModeOptions}
                onChange={(currentNode, selectedNodes) =>
                  setBleedEdgeMode(currentNode.value)
                }
                mode="radioSelect"
                inlineSearchInput
              />
            </Col>
          </Row>
          <Row>
            <Col xs={6}>
              <Form.Label>
                Card spacing: <b>{cardSpacingMM} mm</b>
              </Form.Label>
              <Form.Range
                defaultValue={5}
                min={0}
                max={10}
                step={0.1}
                onChange={(event) => {
                  setCardSpacingMM(parseFloat(event.target.value));
                }}
              />
            </Col>
            <Col xs={6}>
              <Form.Label>
                Page margin: <b>{marginMM} mm</b>
              </Form.Label>
              <Form.Range
                defaultValue={5}
                min={0}
                max={10}
                step={0.1}
                onChange={(event) => {
                  setMarginMM(parseFloat(event.target.value));
                }}
              />
            </Col>
          </Row>
        </Col>
        <Col lg={7}>
          <PDFPreview
            pageSize={pageSize}
            includeCutLines={includeCutLines}
            bleedEdgeMode={BleedEdgeMode[bleedEdgeMode]}
            cardSpacingMM={cardSpacingMM}
            marginMM={marginMM}
            cardDocumentsByIdentifier={cardDocumentsByIdentifier}
          />
        </Col>
      </Row>
    </Container>
  );
}
