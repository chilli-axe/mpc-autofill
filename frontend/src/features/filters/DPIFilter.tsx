import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

import { DPIStep, MaximumDPI, MinimumDPI } from "@/common/constants";
import { FilterSettings } from "@/common/schema_types";

interface DPIFilterProps {
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
  minDPILowerBound?: number;
  maxDPIUpperBound?: number;
}

export const DPIFilter = ({
  filterSettings,
  setFilterSettings,
  minDPILowerBound,
  maxDPIUpperBound,
}: DPIFilterProps) => {
  const effectiveMinDPILowerBound = minDPILowerBound ?? MinimumDPI;
  const effectiveMaxDPIUpperBound = maxDPIUpperBound ?? MaximumDPI;
  return (
    <Row>
      <Col md={6} sm={12}>
        <Form.Label>
          Min resolution:
          <br />
          <b>{filterSettings.minimumDPI} DPI</b>
        </Form.Label>
        <Form.Range
          defaultValue={filterSettings.minimumDPI}
          min={effectiveMinDPILowerBound}
          max={MaximumDPI}
          step={DPIStep}
          onChange={(event) => {
            setFilterSettings({
              ...filterSettings,
              minimumDPI: parseInt(event.target.value),
            });
          }}
        />
      </Col>
      <Col md={6} sm={12}>
        <Form.Label>
          Max resolution:
          <br />
          <b>{filterSettings.maximumDPI} DPI</b>
        </Form.Label>
        <Form.Range
          defaultValue={filterSettings.maximumDPI}
          min={MinimumDPI}
          max={effectiveMaxDPIUpperBound}
          step={DPIStep}
          onChange={(event) => {
            setFilterSettings({
              ...filterSettings,
              maximumDPI: parseInt(event.target.value),
            });
          }}
        />
      </Col>
    </Row>
  );
};
