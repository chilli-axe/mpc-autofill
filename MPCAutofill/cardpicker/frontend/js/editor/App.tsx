import * as React from "react";
import { CardGrid } from "./cardGrid";
import { SearchSettings } from "./searchSettings";
import { AddCards } from "./addCards";
import { ProjectStatus } from "./projectStatus";
import { ViewSettings } from "./viewSettings";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

function App() {
  return (
    <Row>
      <Col lg={8} md={8} sm={6} xs={6}>
        <CardGrid />
      </Col>
      <Col lg={4} md={4} sm={6} xs={6} style={{ zIndex: 1 }}>
        <div className="sticky-top sticky-offset g-0">
          <ProjectStatus />
          <Row className="g-0">
            <Col lg={6} md={12} sm={12} xs={12}>
              <SearchSettings />
            </Col>
            <Col lg={6} md={12} sm={12} xs={12}>
              <AddCards />
            </Col>
          </Row>
          <Row>
            <Col xs={12}>
              <ViewSettings />
            </Col>
          </Row>
        </div>
      </Col>
    </Row>
  );
}

export default App;
