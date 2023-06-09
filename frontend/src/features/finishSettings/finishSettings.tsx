/**
 * A component to the finish settings to configure in MakePlayingCards.
 * At time of writing, this involves choosing from four cardstocks and whether your cards should be foil.
 */

import React from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
// eslint-disable-next-line
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";
import { useDispatch, useSelector } from "react-redux";

import {
  CardstockFoilCompatibility,
  Cardstocks,
  ToggleButtonHeight,
} from "@/common/constants";
import { Cardstock } from "@/common/types";
import {
  selectFinishSettings,
  setCardstock,
  toggleFoil,
} from "@/features/finishSettings/finishSettingsSlice";

export function FinishSettings() {
  const finishSettings = useSelector(selectFinishSettings);
  const dispatch = useDispatch();

  return (
    <>
      <Col lg={8} md={12} sm={12} xs={12}>
        <Form.Group>
          <Form.Select
            value={finishSettings.cardstock}
            style={{ height: ToggleButtonHeight + "px" }}
            onChange={(value) =>
              dispatch(setCardstock(value.target.value as Cardstock))
            }
          >
            {Cardstocks.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col lg={4} md={12} sm={12} xs={12}>
        <Toggle
          onClick={() => dispatch(toggleFoil())}
          on="Foil"
          onClassName="flex-centre"
          off="Non-Foil"
          offClassName="flex-centre"
          onstyle="success"
          offstyle="info"
          width={100 + "%"}
          size="md"
          height={ToggleButtonHeight + "px"}
          active={finishSettings.foil}
          disabled={!CardstockFoilCompatibility[finishSettings.cardstock]}
        />
      </Col>
    </>
  );
}
