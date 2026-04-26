import Form from "react-bootstrap/Form";

import { MaximumSize, SizeStep } from "@/common/constants";
import { FilterSettings } from "@/common/schema_types";

interface SizeFilterProps {
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
  maxSizeUpperBound?: number;
}

export const SizeFilter = ({
  filterSettings,
  setFilterSettings,
  maxSizeUpperBound,
}: SizeFilterProps) => {
  const effectiveMaxSize = maxSizeUpperBound ?? MaximumSize;
  return (
    <>
      <Form.Label>
        File size:
        <br />
        Up to <b>{filterSettings.maximumSize} MB</b>
      </Form.Label>
      <Form.Range
        defaultValue={filterSettings.maximumSize}
        min={0}
        max={effectiveMaxSize}
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
};
