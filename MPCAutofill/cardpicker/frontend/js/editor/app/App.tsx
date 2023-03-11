import * as React from "react";
import { CardGrid } from "../features/card/cardGrid";
import { CommonCardback } from "../features/card/commonCardback";
import { SearchSettings } from "../features/searchSettings/searchSettings";
import { AddCards } from "../features/addCards/addCards";
import { ProjectStatus } from "../features/project/projectStatus";
import { ViewSettings } from "../features/viewSettings/viewSettings";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useEffect } from "react";
import { fetchSourceDocuments } from "../features/search/sourceDocumentsSlice";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./store";

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const cardback =
    useSelector((state: RootState) => state.project.cardback) ?? undefined;
  useEffect(() => {
    dispatch(fetchSourceDocuments());
  }, []);

  return (
    <Row>
      <Col lg={8} md={8} sm={6} xs={6}>
        <CardGrid />
      </Col>
      <Col lg={4} md={4} sm={6} xs={6} style={{ zIndex: 1 }}>
        <div
          className="sticky-top sticky-offset g-0"
          style={{ position: "sticky" }}
        >
          <ProjectStatus />
          <Row className="g-0">
            <ViewSettings />
          </Row>
          <Row className="g-0 py-3">
            <Col lg={6} md={12} sm={12} xs={12}>
              <SearchSettings />
            </Col>
            <Col lg={6} md={12} sm={12} xs={12}>
              <AddCards />
            </Col>
          </Row>
          <Col className="g-0" lg={{ span: 8, offset: 2 }} md={12}>
            <CommonCardback selectedImage={cardback} />
          </Col>
        </div>
      </Col>
    </Row>
  );
}

export default App;
