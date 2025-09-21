/**
 * A component to the finish settings to configure in MakePlayingCards.
 * At time of writing, this involves choosing from five cardstocks and whether your cards should be foil.
 */

import React from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
// eslint-disable-next-line
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import {
  CardstockFoilCompatibility,
  Cardstocks,
  ToggleButtonHeight,
} from "@/common/constants";
import { useAppDispatch, useAppSelector } from "@/common/types";
import { Cardstock } from "@/common/types";
import {
  selectFinishSettings,
  setCardstock,
  toggleFoil,
} from "@/store/slices/finishSettingsSlice";

export function FinishSettings() {
  //# region queries and hooks

  const dispatch = useAppDispatch();
  const finishSettings = useAppSelector(selectFinishSettings);

  //# endregion

  //# region callbacks

  const handleSelectFinish: React.ChangeEventHandler<HTMLSelectElement> = (
    value
  ) => dispatch(setCardstock(value.target.value as Cardstock));
  const handleSelectFoil: React.ChangeEventHandler = () =>
    dispatch(toggleFoil());

  //# endregion

  //# region computed constants

  const toggleFoilDisabled =
    !CardstockFoilCompatibility[finishSettings.cardstock];

  //# endregion

  return (
    <>
      <Col lg={8} md={12} sm={12} xs={12}>
        <Form.Group>
          <Form.Select
            value={finishSettings.cardstock}
            style={{ height: ToggleButtonHeight + "px" }}
            onChange={handleSelectFinish}
          >
            {Cardstocks.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col lg={4} md={12} sm={12} xs={12}>
        <Toggle
          onClick={handleSelectFoil}
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
          disabled={toggleFoilDisabled}
        />
      </Col>
    </>
  );
}
