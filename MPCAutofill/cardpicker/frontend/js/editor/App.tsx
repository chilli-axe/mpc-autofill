import * as React from "react";
import { CardGrid } from "./cardGrid";
import { SearchSettings } from "./searchSettings";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

function App() {
  return (
    <div>
      <h1>Hello world from React!</h1>
      <Row>
        <Col xxl={8} xl={8} lg={8} md={8} sm={6} xs={6}>
          <CardGrid></CardGrid>
        </Col>
        <Col xxl={8} xl={4} lg={4} md={4} sm={6} xs={6}>
          <div className="sticky-top sticky-offset g-0">
            <Row className="g-0" xxl={6} xl={6} lg={6} md={12} sm={12} xs={12}>
              <SearchSettings />
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default App;
