/**
 * This component represents the complete MPC Autofill project editor, ready to
 * drop into a page (as the only component). Must be wrapped with a Redux provider.
 */

import React, { useEffect, useState } from "react";
import { Accordion } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Tab from "react-bootstrap/Tab";

import {
  NavbarHeight,
  NavPillButtonHeight,
  RibbonHeight,
} from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { OverflowCol } from "@/components/OverflowCol";
import { Ribbon } from "@/components/Ribbon";
import { SelectedImagesRibbon } from "@/features/bulkManagement/SelectedImagesRibbon";
import { CardGrid } from "@/features/card/CardGrid";
import { CommonCardback } from "@/features/card/CommonCardback";
import { Export } from "@/features/export/Export";
import { FinishedMyProject } from "@/features/export/FinishedMyProject";
import { FinishSettings } from "@/features/finishSettings/FinishSettings";
import { Import } from "@/features/import/Import";
import { ImportCSV } from "@/features/import/ImportCSV";
import { ImportText } from "@/features/import/ImportText";
import { ImportURL } from "@/features/import/ImportURL";
import { ImportXML } from "@/features/import/ImportXML";
import { SearchSettings } from "@/features/searchSettings/SearchSettings";
import { Status } from "@/features/status/Status";
import {
  selectIsProjectEmpty,
  selectProjectCardback,
} from "@/store/slices/projectSlice";

import { RightPaddedIcon } from "./icon";
import { NavBanner, NavBannerItem } from "./NavBanner";
import { Spinner } from "./Spinner";

type EditorPanel = "import" | "editor" | "finished";

const AddCardsPanel = ({
  onImportComplete,
}: {
  onImportComplete: () => void;
}) => (
  <OverflowCol heightDelta={NavPillButtonHeight + NavbarHeight}>
    <Row className="p-2 g-0">
      <Col lg={6} md={6} sm={12} xs={12} className="px-2">
        <h5>Enter a Card List</h5>
        <ImportText onImportComplete={onImportComplete} />
      </Col>
      <Col lg={6} md={6} sm={12} xs={12} className="px-2">
        <h5>Import a File or URL</h5>
        <Accordion defaultActiveKey="url">
          <Accordion.Item eventKey="url">
            <Accordion.Header>
              <RightPaddedIcon bootstrapIconName="link-45deg" /> URL
            </Accordion.Header>
            <Accordion.Body>
              <ImportURL onImportComplete={onImportComplete} />
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="xml">
            <Accordion.Header>
              <RightPaddedIcon bootstrapIconName="file-code" /> XML
            </Accordion.Header>
            <Accordion.Body>
              <ImportXML onImportComplete={onImportComplete} />
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="csv">
            <Accordion.Header>
              <RightPaddedIcon bootstrapIconName="file-earmark-spreadsheet" />{" "}
              CSV
            </Accordion.Header>
            <Accordion.Body>
              <ImportCSV onImportComplete={onImportComplete} />
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Col>
    </Row>
  </OverflowCol>
);

const ChooseArtPanel = ({
  setEditorPanel,
}: {
  setEditorPanel: (value: EditorPanel) => void;
}) => {
  const cardback = useAppSelector(selectProjectCardback);
  return (
    <>
      <Ribbon position="top" className="g-0">
        <SelectedImagesRibbon />
      </Ribbon>
      <Row className="g-0">
        <OverflowCol
          lg={8}
          md={8}
          sm={6}
          xs={6}
          data-testid="left-panel"
          heightDelta={RibbonHeight + NavPillButtonHeight + NavbarHeight}
        >
          <CardGrid />
        </OverflowCol>
        <OverflowCol
          data-testid="right-panel"
          lg={4}
          md={4}
          sm={6}
          xs={6}
          style={{ zIndex: 1 }}
          className="px-2"
          heightDelta={RibbonHeight + NavPillButtonHeight + NavbarHeight}
        >
          <Status />
          <Row className="g-0 pt-2">
            <FinishSettings />
          </Row>
          <Row className="g-0 pt-2">
            <SearchSettings />
          </Row>
          <Row className="g-0 pt-2">
            <Col lg={7} md={12} sm={12} xs={12}>
              <Import />
            </Col>
            <Col lg={5} md={12} sm={12} xs={12}>
              <Export />
            </Col>
          </Row>
          <Col className="g-0 pt-2" lg={{ span: 8, offset: 2 }} md={12}>
            <CommonCardback selectedImage={cardback} />
          </Col>
        </OverflowCol>
      </Row>
    </>
  );
};

const PrintPanel = () => (
  <OverflowCol heightDelta={NavPillButtonHeight + NavbarHeight}>
    <FinishedMyProject />
  </OverflowCol>
);

function ProjectEditor() {
  // TODO: should we periodically ping the backend to make sure it's still alive?

  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);
  const [editorPanel, setEditorPanel] = useState<EditorPanel>("import");
  const fetchingCardData = useAppSelector(
    (state) => state.cardDocuments.status === "loading"
  );

  /**
   * Ask the user for confirmation before they close the page if their project has any cards in it.
   */
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isProjectEmpty) {
        event.preventDefault();
        return false;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isProjectEmpty]);

  const navBannerItems: Array<NavBannerItem<EditorPanel>> = [
    { key: "import", label: "Add Cards", disabled: false },
    {
      key: "editor",
      label: fetchingCardData ? <Spinner size={1.5} /> : "Choose Art",
      disabled: false,
    },
    { key: "finished", label: "Print!", disabled: isProjectEmpty },
  ];

  return (
    <Tab.Container
      activeKey={editorPanel}
      onSelect={(value) => {
        if (value) setEditorPanel(value as EditorPanel);
      }}
    >
      <Row>
        <Tab.Content>
          <Tab.Pane eventKey="import">
            <AddCardsPanel onImportComplete={() => setEditorPanel("editor")} />
          </Tab.Pane>
          <Tab.Pane eventKey="editor">
            <ChooseArtPanel setEditorPanel={setEditorPanel} />
          </Tab.Pane>
          <Tab.Pane eventKey="finished">
            <PrintPanel />
          </Tab.Pane>
        </Tab.Content>
      </Row>
      <NavBanner items={navBannerItems} variant="pills" />
    </Tab.Container>
  );
}

export default ProjectEditor;
