import { useMemo, useState } from "react";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import { useDebounce } from "use-debounce";

import { BleedEdgeMM, ToggleButtonHeight } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Blurrable } from "@/components/Blurrable";
import { OverflowCol } from "@/components/OverflowCol";
import { Spinner } from "@/components/Spinner";
import { ClientSearchService } from "@/features/clientSearch/clientSearchService";
import { downloadFile, useDoFileDownload } from "@/features/download/download";
import { CardSelectionMode, PageSize, PDFProps } from "@/features/pdf/PDF";
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

interface NumericFieldProps {
  label: string;
  value: number | undefined;
  setValue: (value: number | undefined) => void;
  min?: number;
  step?: number;
  max?: number;
}

const NumericField = (props: NumericFieldProps) => {
  const valueIsValid = (value: number) =>
    (props.min === undefined || props.min <= value) &&
    (props.max === undefined || props.max >= value);
  return (
    <>
      <Form.Label>{props.label}</Form.Label>
      <Form.Control
        type="number"
        min={props.min}
        step={props.step}
        value={props.value}
        isValid={props.value !== undefined && valueIsValid(props.value)}
        onChange={(event) => {
          const value = parseFloat(event.target.value);
          if (Number.isNaN(value)) {
            props.setValue(undefined);
          } else if (valueIsValid(value)) {
            props.setValue(value);
          }
        }}
      />
    </>
  );
};

export const PDFGenerator = ({ heightDelta = 0 }: { heightDelta?: number }) => {
  // TODO: include fronts / include fronts and unique backs / include fronts and backs
  const dispatch = useAppDispatch();
  const [cardSpacingRowMM, setCardSpacingRowMM] = useState<number | undefined>(
    0
  );
  const [cardSpacingColMM, setCardSpacingColMM] = useState<number | undefined>(
    0
  );
  const [pageMarginTopMM, setPageMarginTopMM] = useState<number | undefined>(5);
  const [pageMarginBottomMM, setPageMarginBottomMM] = useState<
    number | undefined
  >(5);
  const [pageMarginLeftMM, setPageMarginLeftMM] = useState<number | undefined>(
    5
  );
  const [pageMarginRightMM, setPageMarginRightMM] = useState<
    number | undefined
  >(5);
  const [bleedEdgeMM, setBleedEdgeMM] = useState<number | undefined>(0);
  const [roundCorners, setRoundCorners] = useState<boolean>(false);

  const { clientSearchService } = useClientSearchContext();
  const projectMembers = useAppSelector(selectProjectMembers);
  const projectCardback = useAppSelector(selectProjectCardback);

  const [pageSize, setPageSize] = useState<keyof typeof PageSize>(PageSize.A4);
  const [pageWidth, setPageWidth] = useState<number | undefined>(undefined);
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);

  const isCustomPageSize = pageSize === "CUSTOM";

  const pageSizeOptions = useMemo(
    () =>
      Object.entries(PageSize).map(([value, label]) => ({
        value,
        label,
        checked: value === pageSize,
      })),
    [pageSize]
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
    pageWidth: pageWidth,
    pageHeight: pageHeight,
    bleedEdgeMM: bleedEdgeMM ?? 0,
    roundCorners: roundCorners,
    cardSpacingRowMM: cardSpacingRowMM ?? 0,
    cardSpacingColMM: cardSpacingColMM ?? 0,
    pageMarginTopMM: pageMarginTopMM ?? 0,
    pageMarginBottomMM: pageMarginBottomMM ?? 0,
    pageMarginLeftMM: pageMarginLeftMM ?? 0,
    pageMarginRightMM: pageMarginRightMM ?? 0,
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
            In particular, please note that generated PDFs can be large and can
            take a while to download.
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
          <Row>
            <Col xs={12}>
              <Form.Label>Page size</Form.Label>
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
          {isCustomPageSize && (
            <Row>
              <Col xl={6} lg={12} md={12} sm={12} xs={12}>
                <NumericField
                  label="Custom page width (mm)"
                  value={pageWidth}
                  setValue={setPageWidth}
                  min={0}
                  step={0.1}
                />
              </Col>
              <Col xl={6} lg={12} md={12} sm={12} xs={12}>
                <NumericField
                  label="Custom page height (mm)"
                  value={pageHeight}
                  setValue={setPageHeight}
                  min={0}
                  step={0.1}
                />
              </Col>
            </Row>
          )}
          <Row>
            <Col sm={12}>
              <NumericField
                label={`Bleed edge (max: ${BleedEdgeMM} mm)`}
                value={bleedEdgeMM}
                setValue={setBleedEdgeMM}
                min={0}
                max={BleedEdgeMM}
                step={0.001}
              />
              <Form.Label>Corners</Form.Label>
              <Toggle
                onClick={() => setRoundCorners(!roundCorners)}
                on="Round"
                onClassName="flex-centre"
                off="Square"
                offClassName="flex-centre"
                onstyle="success"
                offstyle="info"
                width={100 + "%"}
                size="md"
                height={ToggleButtonHeight + "px"}
                active={roundCorners}
              />
            </Col>
          </Row>
          <Row>
            <Col lg={6} md={12} sm={12} xs={12}>
              <NumericField
                label="Row spacing (mm)"
                value={cardSpacingRowMM}
                setValue={setCardSpacingRowMM}
                min={0}
                step={0.1}
              />
            </Col>
            <Col lg={6} md={12} sm={12} xs={12}>
              <NumericField
                label="Column spacing (mm)"
                value={cardSpacingColMM}
                setValue={setCardSpacingColMM}
                min={0}
                step={0.1}
              />
            </Col>
          </Row>
          <Row>
            <Col xs={6}>
              <NumericField
                label="Page margin top (mm)"
                value={pageMarginTopMM}
                setValue={setPageMarginTopMM}
                min={0}
                step={0.1}
              />
            </Col>
            <Col xs={6}>
              <NumericField
                label="Page margin bottom (mm)"
                value={pageMarginBottomMM}
                setValue={setPageMarginBottomMM}
                min={0}
                step={0.1}
              />
            </Col>
          </Row>
          <Row>
            <Col xs={6}>
              <NumericField
                label="Page margin left (mm)"
                value={pageMarginLeftMM}
                setValue={setPageMarginLeftMM}
                min={0}
                step={0.1}
              />
            </Col>
            <Col xs={6}>
              <NumericField
                label="Page margin right (mm)"
                value={pageMarginRightMM}
                setValue={setPageMarginRightMM}
                min={0}
                step={0.1}
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
