import * as React from "react";
import { CardGrid } from "./cardGrid";
import { SearchSettings } from "./searchSettings";
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
          <h2>Edit MPC Project</h2>
          <Col lg={6} md={12} sm={12} xs={12}>
            <SearchSettings />
          </Col>
        </div>
      </Col>
    </Row>
  );
}

export default App;
