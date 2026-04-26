import Form from "react-bootstrap/Form";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";

interface CompressedFilterProps {
  compressed: boolean;
  setCompressed: (value: boolean) => void;
}

export const CompressedFilter = ({
  compressed,
  setCompressed,
}: CompressedFilterProps) => {
  return (
    <>
      <Form.Label>Card display style</Form.Label>
      <Toggle
        onClick={() => setCompressed(!compressed)}
        on="Compressed"
        onClassName="flex-centre"
        off="Relaxed"
        offClassName="flex-centre"
        onstyle="info"
        offstyle="success"
        width={100 + "%"}
        size="md"
        height={ToggleButtonHeight + "px"}
        active={compressed}
      />
    </>
  );
};
