/**
 * A series of numeric range filters which allow control over which Cards are included in search results.
 * Users can filter on a DPI range and set a maximum allowable file size.
 * This component forms part of the Search Settings modal.
 */

import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import {
  DPIStep,
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  SizeStep,
} from "../../common/constants";
import React from "react";

interface FilterSettingsProps {
  localMinimumDPI: number;
  localMaximumDPI: number;
  localMaximumSize: number;
  setLocalMinimumDPI: {
    (newLocalMinimumDPI: number): void;
  };
  setLocalMaximumDPI: {
    (newLocalMaximumDPI: number): void;
  };
  setLocalMaximumSize: {
    (newLocalMaximumSize: number): void;
  };
}

export function FilterSettings(props: FilterSettingsProps) {
  return (
    <>
      <h5>Filters</h5>
      Configure the DPI (dots per inch) and file size ranges the search results
      must be within.
      <br />
      At a fixed physical size, a higher DPI yields a higher resolution print.
      <br />
      MakePlayingCards prints cards up to <b>800 DPI</b>, meaning an 800 DPI
      print and a 1200 DPI print will <b>look the same</b>.
      <br />
      <br />
      <Row>
        <Col xs={6}>
          <Form.Label>
            Minimum: <b>{props.localMinimumDPI} DPI</b>
          </Form.Label>
          <Form.Range
            defaultValue={props.localMinimumDPI}
            min={MinimumDPI}
            max={MaximumDPI}
            step={DPIStep}
            onChange={(event) => {
              props.setLocalMinimumDPI(parseInt(event.target.value));
            }}
          />
        </Col>
        <Col xs={6}>
          <Form.Label>
            Maximum: <b>{props.localMaximumDPI} DPI</b>
          </Form.Label>
          <Form.Range
            defaultValue={props.localMaximumDPI}
            min={MinimumDPI}
            max={MaximumDPI}
            step={DPIStep}
            onChange={(event) => {
              props.setLocalMaximumDPI(parseInt(event.target.value));
            }}
          />
        </Col>
      </Row>
      <Form.Label>
        File size: Up to <b>{props.localMaximumSize} MB</b>
      </Form.Label>
      <Form.Range
        defaultValue={props.localMaximumSize}
        min={0}
        max={MaximumSize}
        step={SizeStep}
        onChange={(event) => {
          props.setLocalMaximumSize(parseInt(event.target.value));
        }}
      />
    </>
  );
}
