import {
  Document,
  Page,
  PDFViewer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { useState } from "react";
import React from "react";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { PageSizes, SlotProjectMembers, useAppSelector } from "@/common/types";
import { selectProjectMembers } from "@/store/slices/projectSlice";

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#E4E4E4",
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
});

interface PDFPreviewProps {
  pageSize: PageSizes;
  includeCorners: boolean;
  includeBleedEdge: boolean;
  includeCutLines: boolean;
  cardSpacingCM: number;
}

function PDFDocument({
  pageSize,
  includeCorners,
  includeCutLines,
  includeBleedEdge,
  cardSpacingCM,
  projectMembers,
}: PDFPreviewProps & { projectMembers: Array<SlotProjectMembers> }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {projectMembers.map((member) => (
          <View style={styles.section}>
            <Text>{member.front.selectedImage}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function PDFPreview(props: PDFPreviewProps) {
  const projectMembers = useAppSelector(selectProjectMembers); // TODO: not in redux context?
  return (
    <PDFViewer width="100%" showToolbar={false}>
      <PDFDocument {...props} projectMembers={projectMembers} />
    </PDFViewer>
  );
}

export function PDFGenerator() {
  // TODO: include fronts / include fronts and unique backs / include fronts and backs
  const [pageSize, setPageSize] = useState<PageSizes>("A4");
  const [includeCorners, setIncludeCorners] = useState<boolean>(false);
  const [includeBleedEdge, setIncludeBleedEdge] = useState<boolean>(false);
  const [includeCutLines, setIncludeCutLines] = useState<boolean>(false);
  const [cardSpacingCM, setCardSpacingCM] = useState<number>(1);

  return (
    <Container>
      <Row>
        <Col lg={5} className="mb-3 mb-lg-0">
          <Toggle
            onClick={() => setIncludeCorners((value) => !value)}
            on="Square Corners"
            onClassName="flex-centre"
            off="Round Corners"
            offClassName="flex-centre"
            onstyle="primary"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={ToggleButtonHeight + "px"}
            active={includeCorners}
          />
          <br />
          <br />
          <Toggle
            onClick={() => setIncludeBleedEdge((value) => !value)}
            on="Include Print Bleed"
            onClassName="flex-centre"
            off="Exclude Print Bleed"
            offClassName="flex-centre"
            onstyle="primary"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={ToggleButtonHeight + "px"}
            active={includeBleedEdge}
          />
          <br />
          <br />
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
        </Col>
        <Col lg={7}>
          <PDFPreview
            pageSize={pageSize}
            includeCorners={includeCorners}
            includeCutLines={includeCutLines}
            includeBleedEdge={includeBleedEdge}
            cardSpacingCM={cardSpacingCM}
          />
        </Col>
      </Row>
    </Container>
  );
}
