import { useMemo, useState } from "react";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { useDebounce } from "use-debounce";

import { ProjectName } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Blurrable } from "@/components/Blurrable";
import { OverflowCol } from "@/components/OverflowCol";
import { Spinner } from "@/components/Spinner";
import { ClientSearchService } from "@/features/clientSearch/clientSearchService";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import {
  BleedEdgeMode,
  CardSelectionMode,
  PageSize,
  PDFProps,
} from "@/features/pdf/PDF";
import { pdfRenderService } from "@/features/pdf/pdfRenderService";
import { useCardDocumentsByIdentifier } from "@/store/slices/cardDocumentsSlice";
import {
  selectProjectCardback,
  selectProjectMembers,
} from "@/store/slices/projectSlice";
import { setNotification } from "@/store/slices/toastsSlice";
import { AppDispatch } from "@/store/store";

import { useClientSearchContext } from "../clientSearch/clientSearchContext";
import { useRenderPDF } from "./useRenderPDF";

const PDFPreview = (props: PDFProps & { url: string | undefined }) => {
  return <iframe width="100%" height="100%" src={props.url} {...props} />;
};

const downloadPDF = async (
  props: Omit<PDFProps, "fileHandles">,
  clientSearchService: ClientSearchService,
  dispatch: AppDispatch
): Promise<boolean> => {
  const fileHandles = await clientSearchService.getFileHandlesByIdentifier(
    props.cardDocumentsByIdentifier
  );
  dispatch(
    setNotification([
      Math.random().toString(),
      {
        name: "Download Started",
        message: "Generating your PDF...",
        level: "info",
      },
    ])
  );
  return pdfRenderService
    .renderPDF({ ...props, fileHandles })
    .then((blob) =>
      downloadFile(blob, undefined, "cards.pdf", clientSearchService)
    )
    .then(() => true);
};

const useDownloadPDF = (
  props: Omit<PDFProps, "fileHandles">,
  clientSearchService: ClientSearchService,
  dispatch: AppDispatch
) => {
  const doFileDownload = useDoFileDownload();
  return () =>
    Promise.resolve(
      doFileDownload(
        "pdf",
        "cards.pdf",
        (): Promise<boolean> =>
          downloadPDF(props, clientSearchService, dispatch)
      )
    );
};

export const PDFGenerator = ({ heightDelta = 0 }: { heightDelta?: number }) => {
  // TODO: include fronts / include fronts and unique backs / include fronts and backs
  const dispatch = useAppDispatch();
  const [cardSpacingMM, setCardSpacingMM] = useState<number>(5);
  const [marginMM, setMarginMM] = useState<number>(5);

  const { clientSearchService } = useClientSearchContext();
  const projectMembers = useAppSelector(selectProjectMembers);
  const projectCardback = useAppSelector(selectProjectCardback);

  const [pageSize, setPageSize] = useState<keyof typeof PageSize>(PageSize.A4);
  const pageSizeOptions = useMemo(
    () =>
      Object.entries(PageSize).map(([value, label]) => ({
        value,
        label,
        checked: value === pageSize,
      })),
    [pageSize]
  );
  const [bleedEdgeMode, setBleedEdgeMode] = useState<
    keyof typeof BleedEdgeMode
  >("hideBleedEdgeWithRoundCorners");
  const bleedEdgeModeOptions = useMemo(
    () =>
      Object.entries(BleedEdgeMode).map(([value, label]) => ({
        value,
        label,
        checked: value === bleedEdgeMode,
      })),
    [bleedEdgeMode]
  );
  const [cardSelectionMode, setCardSelectionMode] = useState<
    keyof typeof CardSelectionMode
  >("frontsAndDistinctBacks");
  const cardSelectionModeOptions = useMemo(
    () =>
      Object.entries(CardSelectionMode).map(([value, label]) => ({
        value,
        label,
        checked: value === cardSelectionMode,
      })),
    [cardSelectionMode]
  );

  const cardDocumentsByIdentifier = useCardDocumentsByIdentifier();

  // TODO: look at when i'm more awake
  function equalityFn<T>(left: T, right: T): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  const pdfProps: Omit<PDFProps, "fileHandles"> = {
    cardSelectionMode: cardSelectionMode,
    pageSize: pageSize,
    bleedEdgeMode: bleedEdgeMode,
    cardSpacingMM: cardSpacingMM,
    marginMM: marginMM,
    cardDocumentsByIdentifier: cardDocumentsByIdentifier,
    projectMembers: projectMembers,
    projectCardback: projectCardback,
    // the following settings don't matter for previewing and should remain stable to prevent unnecessary re-renders.
    imageQuality: "small-thumbnail",
  };
  const [debouncedPDFProps, debouncedState] = useDebounce(pdfProps, 500, {
    equalityFn,
  });

  const { url, loading, error } = useRenderPDF(debouncedPDFProps);

  const showSpinner = debouncedState.isPending() || loading;

  const downloadPDF = useDownloadPDF(
    {
      ...debouncedPDFProps,
      imageQuality: "full-resolution",
    },
    clientSearchService,
    dispatch
  );

  return (
    <Container fluid>
      <Row>
        <OverflowCol
          lg={3}
          md={4}
          sm={5}
          xs={6}
          className="py-2"
          heightDelta={67.9 + 71 + heightDelta}
        >
          <Alert variant="info">
            We are actively working to improve this experience.
            <br />
            In particular, please note that generated PDFs can be large.
            <br />
            Please send any feature requests, bug reports, and other discussion
            to the{" "}
            <a
              href="https://github.com/chilli-axe/mpc-autofill"
              target="_blank"
            >
              GitHub repo
            </a>
            . Thanks for your patience!
          </Alert>
          <p>
            Generate a PDF file from your project suitable for printing at home
            or professionally.
          </p>
          <ol>
            <li>
              Configure how your PDF should be laid out with the settings below.
            </li>
            <li>
              A <b>live preview</b> of your PDF is shown on the right-hand side.
            </li>
            <li>
              When you&apos;re done, click the <b>Generate PDF</b> button below!
            </li>
          </ol>
          <hr />
          <Form.Label>Select which cards to include</Form.Label>
          <StyledDropdownTreeSelect
            data={cardSelectionModeOptions}
            onChange={(currentNode, selectedNodes) =>
              setCardSelectionMode(
                currentNode.value as keyof typeof CardSelectionMode
              )
            }
            mode="radioSelect"
            inlineSearchInput
          />
          <br />
          <Row>
            <Col xl={6} lg={12} md={12} sm={12} xs={12}>
              <Form.Label>Configure bleed edge</Form.Label>
              <StyledDropdownTreeSelect
                data={bleedEdgeModeOptions}
                onChange={(currentNode, selectedNodes) =>
                  setBleedEdgeMode(
                    currentNode.value as keyof typeof BleedEdgeMode
                  )
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
                  setPageSize(currentNode.value as keyof typeof PageSize)
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
          <hr />
          <div className="d-grid gap-0">
            <Button onClick={downloadPDF}>Generate PDF</Button>
          </div>
        </OverflowCol>
        <Col lg={9} md={8} sm={7} xs={6} style={{ position: "relative" }}>
          {showSpinner && (
            <Spinner size={6} zIndex={3} positionAbsolute={true} />
          )}
          <Blurrable disabled={showSpinner} style={{ height: 100 + "%" }}>
            <PDFPreview url={url} {...debouncedPDFProps} fileHandles={{}} />
          </Blurrable>
        </Col>
      </Row>
    </Container>
  );
};
