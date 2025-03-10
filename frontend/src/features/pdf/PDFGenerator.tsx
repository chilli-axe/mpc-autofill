import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";

function PDFSettings() {
  return <div>hello</div>;
}

function PDFPreview() {
  return <div>world</div>;
}

export function PDFGenerator() {
  return (
    <Container>
      <Row>
        <Col lg={5} className="mb-3 mb-lg-0">
          <PDFSettings />
        </Col>
        <Col lg={7}>
          <PDFPreview />
        </Col>
      </Row>
    </Container>
  );
}
