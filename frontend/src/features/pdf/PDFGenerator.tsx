import { useState } from "react";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { PageSizes, useAppSelector } from "@/common/types";
import { selectProjectMembers } from "@/store/slices/projectSlice";
interface PDFPreviewProps {
  pageSize: PageSizes;
  includeCorners: boolean;
  includeBleedEdge: boolean;
  includeCutLines: boolean;
  cardSpacingCM: number;
}

function PDFPreview({
  pageSize,
  includeCorners,
  includeCutLines,
  includeBleedEdge,
  cardSpacingCM,
}: PDFPreviewProps) {
  const projectMembers = useAppSelector(selectProjectMembers);

  return <div>world</div>;
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
