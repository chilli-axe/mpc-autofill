import { useMemo, useState } from "react";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import { useDebounce } from "use-debounce";

import { ToggleButtonHeight } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useAppSelector } from "@/common/types";
import { Blurrable } from "@/components/Blurrable";
import { OverflowCol } from "@/components/OverflowCol";
import { Spinner } from "@/components/Spinner";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { BleedEdgeMode,PageSize, PDF, PDFProps } from "@/features/pdf/PDF";
import { pdfRenderService } from "@/features/pdf/pdfRenderService";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectProjectMembers } from "@/store/slices/projectSlice";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { usePDFRenderContext } from "./pdfRenderContext";
import { useRenderPDF } from "./useRenderPDF";

const PDFPreview = (props: PDFProps & {url: string | undefined}) => {
  return (
    <>
      <iframe
        width="100%"
        height="100%"
        src={props.url}
        {...props}
      />
      </>
  );
}

export const PDFGenerator = () => {
  // TODO: include fronts / include fronts and unique backs / include fronts and backs
  const [includeCutLines, setIncludeCutLines] = useState<boolean>(false);
  const [cardSpacingMM, setCardSpacingMM] = useState<number>(5);
  const [marginMM, setMarginMM] = useState<number>(5);
  const [dpi, setDPI] = useState<number>(600);

  const {clientSearchService} = useClientSearchContext();
  const projectMembers = useAppSelector(selectProjectMembers);

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

  // TODO: look at when i'm more awake
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const [debouncedPDFProps, debouncedState] = useDebounce(
    {
      pageSize: pageSize satisfies PageSize,
      includeCutLines: includeCutLines,
      bleedEdgeMode: BleedEdgeMode[bleedEdgeMode],
      cardSpacingMM: cardSpacingMM,
      marginMM: marginMM,
      cardDocumentsByIdentifier: cardDocumentsByIdentifier,
      imageQuality: "small-thumbnail",
      dpi: 300, // don't re-render preview when this changes. choose some arbitrary stable value.
      projectMembers: projectMembers,
    } satisfies PDFProps,
    500, { equalityFn }
  )

  // const { clientSearchService } = useClientSearchContext();
  const { url, loading, error } = useRenderPDF(debouncedPDFProps);

  const showSpinner = debouncedState.isPending() || loading;

  const generatePDF = async () => {
    const fileHandles = await clientSearchService.getFileHandlesByIdentifier(cardDocumentsByIdentifier);
    return pdfRenderService.renderPDF(
      {
        ...debouncedPDFProps,
        projectMembers,
        imageQuality: "full-resolution",
        fileHandles,
      }
    ).then((blob) => downloadFile(blob, undefined, "cards.pdf", clientSearchService));
  }

  return (
    <Container fluid>
      <Row>
        <OverflowCol lg={3} md={4} sm={5} xs={6} className="py-2" heightDelta={67.9+71}>
          {/* <h3>Download PDF</h3> */}
          <p>
            Generate a PDF file from your project suitable for printing at home or professionally.
          </p>
          <ol>
            <li>Configure how your PDF should be laid out with the settings below.</li>
            <li>A <b>live preview</b> of your PDF is shown on the right-hand side.</li>
            <li>When you&apos;re done, click the <b>Generate PDF</b> button below!</li>
          </ol>
          <hr />
          <div className="px-0">
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
          </div>
          <br />
          <Row>
          <Col xl={6} lg={12} md={12} sm={12} xs={12}>
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
            <Col xl={6} lg={12} md={12} sm={12} xs={12}>
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
          </Row>
          <Row>
            <Col lg={6} md={12} sm={12} xs={12}>
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
            <Col lg={6} md={12} sm={12} xs={12}>
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
          <Row>
            <Col lg={6} md={12} sm={12} xs={12}>
              <Form.Label>
                Card image DPI: <b>{dpi} DPI</b>
              </Form.Label>
              <Form.Range
                defaultValue={600}
                min={100}
                max={1500}
                step={100}
                onChange={(event) => {
                  setDPI(parseInt(event.target.value));
                }}
              />
            </Col>
            {/* <Col lg={6} md={12} sm={12} xs={12}>
              <Form.Label>
                Card image quality: <b>{cardImageQuality} mm</b>
              </Form.Label>
              <StyledDropdownTreeSelect
                data={bleedEdgeModeOptions}
                onChange={(currentNode, selectedNodes) =>
                  setBleedEdgeMode(currentNode.value)
                }
                mode="radioSelect"
                inlineSearchInput
              />
            </Col> */}
          </Row>
          <hr />
          <div className="d-grid gap-0">
            <Button onClick={generatePDF} >
              Generate PDF
            </Button>
          </div>
        </OverflowCol>
        <Col lg={9} md={8} sm={7} xs={6} style={{ position: "relative" }}>
          {showSpinner && <Spinner size={6} zIndex={3} positionAbsolute={true} />}
          <Blurrable disabled={showSpinner} style={{height: 100 + "%"}} >
          <PDFPreview
             url={url} {...debouncedPDFProps}
          />
          </Blurrable>
        </Col>
      </Row>
    </Container>
  );
}
