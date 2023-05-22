/**
 * A series of numeric range filters which allow control over which Cards are included in search results.
 * Users can filter on a DPI range and set a maximum allowable file size.
 * This component forms part of the Search Settings modal.
 */

import React from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

import {
  DPIStep,
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  SizeStep,
} from "@/common/constants";
import { FilterSettings as FilterSettingsType } from "@/common/types";

interface FilterSettingsProps {
  filterSettings: FilterSettingsType;
  setFilterSettings: {
    (newFilterSettings: FilterSettingsType): void;
  };
}

export function FilterSettings({
  filterSettings,
  setFilterSettings,
}: FilterSettingsProps) {
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
            Minimum: <b>{filterSettings.minimumDPI} DPI</b>
          </Form.Label>
          <Form.Range
            defaultValue={filterSettings.minimumDPI}
            min={MinimumDPI}
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
        <Col xs={6}>
          <Form.Label>
            Maximum: <b>{filterSettings.maximumDPI} DPI</b>
          </Form.Label>
          <Form.Range
            defaultValue={filterSettings.maximumDPI}
            min={MinimumDPI}
            max={MaximumDPI}
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
      <Form.Label>
        File size: Up to <b>{filterSettings.maximumSize} MB</b>
      </Form.Label>
      <Form.Range
        defaultValue={filterSettings.maximumSize}
        min={0}
        max={MaximumSize}
        step={SizeStep}
        onChange={(event) => {
          setFilterSettings({
            ...filterSettings,
            maximumSize: parseInt(event.target.value),
          });
        }}
      />
    </>
  );
}
