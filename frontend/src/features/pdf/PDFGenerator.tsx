import { PDFViewer } from "@react-pdf/renderer";
import { useMemo, useState } from "react";
import React from "react";
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
import { BleedEdgeMode,PageSize, PDF, PDFProps } from "@/features/pdf/PDF";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import { selectProjectMembers } from "@/store/slices/projectSlice";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { useRenderPDF } from "./useRenderPDF";

const PDFPreview = (props: Omit<PDFProps, "clientSearchService" | "projectMembers">) => {
  const projectMembers = useAppSelector(selectProjectMembers); // TODO: not in redux context?
  // const { clientSearchService } = useClientSearchContext();
  const { url, loading, error } = useRenderPDF({
    pageSize: props.pageSize,
    includeCutLines: props.includeCutLines,
    bleedEdgeMode: props.bleedEdgeMode,
    cardSpacingMM: props.cardSpacingMM,
    marginMM: props.marginMM,
    cardDocumentsByIdentifier: props.cardDocumentsByIdentifier,
    projectMembers,
    // clientSearchService,
    // innerRef,
  });

  return (
    <>

      <iframe
        // @ts-ignore
        src={url}
        width="100%"
        height="100%"
        // ref={innerRef}
        // @ts-ignore
        // style={style}
        // className={className}
        {...props}
      />
    </>
    // <PDFViewer width="100%" height="100%" showToolbar={false}>
    //   <PDF {...props} projectMembers={projectMembers} clientSearchService={clientSearchService} />
    // </PDFViewer>
  );
}

export const PDFGenerator = () => {
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

  // TODO: look at when i'm more awake
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const [debouncedPDFProps] = useDebounce(
    {
      pageSize: pageSize satisfies PageSize,
      includeCutLines: includeCutLines,
      bleedEdgeMode: BleedEdgeMode[bleedEdgeMode],
      cardSpacingMM: cardSpacingMM,
      marginMM: marginMM,
      cardDocumentsByIdentifier: cardDocumentsByIdentifier,
    } satisfies PDFProps,
    500, { equalityFn }
  )

  return (
    <Container style={{ height: 100 + "%" }}>
      <Row style={{ height: 100 + "%" }}>
        <Col xs={3} className="mb-3 mb-lg-0">
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
            <Col lg={6} md={12} sm={12} xs={12}>
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
            <Col lg={6} md={12} sm={12} xs={12}>
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
        </Col>
        <Col xs={9}>
          <PDFPreview
            {...debouncedPDFProps}
          />
        </Col>
      </Row>
    </Container>
  );
}
