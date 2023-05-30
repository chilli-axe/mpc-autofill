/**
 * This component represents the complete MPC Autofill project editor, ready to
 * drop into a page (as the only component). Must be wrapped with a Redux provider.
 */

import React, { useEffect } from "react";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useDispatch, useSelector } from "react-redux";
import { ThunkDispatch } from "redux-thunk";
import styled from "styled-components";

import { RootState } from "@/app/store";
import { NavbarHeight } from "@/common/constants";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { CardGrid } from "@/features/card/cardGrid";
import { CommonCardback } from "@/features/card/commonCardback";
import { Import } from "@/features/import/import";
import { ProjectStatus } from "@/features/project/projectStatus";
import { fetchSourceDocuments } from "@/features/search/sourceDocumentsSlice";
import { SearchSettings } from "@/features/searchSettings/searchSettings";
import DisableSSR from "@/features/ui/disableSSR";
import { NoBackendDefault } from "@/features/ui/noBackendDefault";
import { ViewSettings } from "@/features/viewSettings/viewSettings";

const OverflowCol = styled(Col)`
  height: calc(
    100vh - ${NavbarHeight}px
  ); // for compatibility with older browsers
  height: calc(100dvh - ${NavbarHeight}px); // handles the ios address bar
  overflow-y: scroll;
  overscroll-behavior: none;
`;

function App() {
  // TODO: should we periodically ping the backend to make sure it's still alive?
  //       and is there a better check for whether to show backend data rather than the URL not being null?
  const backendURL = useSelector(selectBackendURL);
  const dispatch = useDispatch<ThunkDispatch<any, any, any>>();
  const cardback =
    useSelector((state: RootState) => state.project.cardback) ?? undefined;
  useEffect(() => {
    dispatch(fetchSourceDocuments());
  }, [dispatch]);

  return (
    <>
      {backendURL != null ? (
        <Row className="g-0">
          <OverflowCol lg={8} md={8} sm={6} xs={6}>
            <CardGrid />
          </OverflowCol>
          <OverflowCol
            lg={4}
            md={4}
            sm={6}
            xs={6}
            style={{ zIndex: 1 }}
            className="px-2"
          >
            {/* TODO: the fact that we have to do this for XML generation to work is dumb. fix it!
        XMLs shouldn't constantly recalculate, they should only calculate on-demand; same with decklists. */}
            <DisableSSR>
              <ProjectStatus />
            </DisableSSR>
            <Row className="g-0">
              <ViewSettings />
            </Row>
            <Row className="g-0 py-3">
              <Col lg={6} md={12} sm={12} xs={12}>
                <SearchSettings />
              </Col>
              <Col lg={6} md={12} sm={12} xs={12}>
                <Import />
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
