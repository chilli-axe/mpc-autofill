/**
 * This component represents the complete MPC Autofill project editor, ready to
 * drop into a page (as the only component). Must be wrapped with a Redux provider.
 */

import styled from "@emotion/styled";
import React, { useEffect } from "react";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import { RibbonHeight } from "@/common/constants";
import { useAppSelector } from "@/common/types";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import { OverflowCol } from "@/components/OverflowCol";
import { Ribbon } from "@/components/Ribbon";
import { SelectedImagesRibbon } from "@/features/bulkManagement/SelectedImagesRibbon";
import { CardGrid } from "@/features/card/CardGrid";
import { CommonCardback } from "@/features/card/CommonCardback";
import { Export } from "@/features/export/Export";
import { FinishedMyProject } from "@/features/export/FinishedMyProjectModal";
import { FinishSettings } from "@/features/finishSettings/FinishSettings";
import { Import } from "@/features/import/Import";
import { SearchSettings } from "@/features/searchSettings/SearchSettings";
import { Status } from "@/features/status/Status";
import { useRemoteBackendConfigured } from "@/store/slices/backendSlice";
import {
  selectIsProjectEmpty,
  selectProjectCardback,
} from "@/store/slices/projectSlice";

function ProjectEditor() {
  // TODO: should we periodically ping the backend to make sure it's still alive?
  //# region queries and hooks

  const cardback = useAppSelector(selectProjectCardback);
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  //# endregion

  //# region effects

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

  //# endregion

  return (
    <Row className="g-0">
      <Ribbon className="g-0">
        <SelectedImagesRibbon />
      </Ribbon>
      <OverflowCol
        lg={8}
        md={8}
        sm={6}
        xs={6}
        data-testid="left-panel"
        heightDelta={RibbonHeight}
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
        heightDelta={RibbonHeight}
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
          <FinishedMyProject />
        </Row>
        <Col className="g-0 pt-2" lg={{ span: 8, offset: 2 }} md={12}>
          <CommonCardback selectedImage={cardback} />
        </Col>
      </OverflowCol>
    </Row>
  );
}

export default ProjectEditor;
