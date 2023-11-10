/**
 * This component represents the complete MPC Autofill project editor, ready to
 * drop into a page (as the only component). Must be wrapped with a Redux provider.
 */

import React, { useEffect } from "react";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import styled from "styled-components";

import { NavbarHeight } from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { NoBackendDefault } from "@/components/noBackendDefault";
import {
  selectBackendURL,
  useBackendConfigured,
} from "@/features/backend/backendSlice";
import { CardGrid } from "@/features/card/cardGrid";
import { CommonCardback } from "@/features/card/commonCardback";
import { Export } from "@/features/export/export";
import { FinishSettings } from "@/features/finishSettings/finishSettings";
import { Import } from "@/features/import/import";
import {
  selectIsProjectEmpty,
  selectProjectCardback,
} from "@/features/project/projectSlice";
import { fetchSourceDocumentsAndReportError } from "@/features/search/sourceDocumentsSlice";
import { SearchSettings } from "@/features/searchSettings/searchSettings";
import { Status } from "@/features/status/status";

const OverflowCol = styled(Col)`
  position: relative;
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
  overflow-y: scroll;
  overscroll-behavior: none;
  scrollbar-width: thin;
`;

function App() {
  // TODO: should we periodically ping the backend to make sure it's still alive?
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const backendConfigured = useBackendConfigured();
  const backendURL = useAppSelector(selectBackendURL);
  const cardback = useAppSelector(selectProjectCardback);
  const isProjectEmpty = useAppSelector(selectIsProjectEmpty);

  //# endregion

  //# region effects

  useEffect(() => {
    /**
     * Ask the user for confirmation before they close the page if their project has any cards in it.
     */

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
    <>
      {backendConfigured ? (
        <Row className="g-0">
          <OverflowCol lg={8} md={8} sm={6} xs={6} data-testid="left-panel">
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
          >
            <Status />
            <Row className="g-0 pb-3">
              <FinishSettings />
            </Row>
            <Row className="g-0">
              <SearchSettings />
            </Row>
            <Row className="g-0 py-3">
              <Col lg={6} md={12} sm={12} xs={12}>
                <Import />
              </Col>
              <Col lg={6} md={12} sm={12} xs={12}>
                <Export />
              </Col>
            </Row>
            <Col className="g-0" lg={{ span: 8, offset: 2 }} md={12}>
              <CommonCardback selectedImage={cardback} />
            </Col>
          </OverflowCol>
        </Row>
      ) : (
        <NoBackendDefault />
      )}
    </>
  );
}

export default App;
