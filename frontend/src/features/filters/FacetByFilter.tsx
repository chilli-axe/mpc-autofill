import { useMemo } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { FacetBy } from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";

interface FacetByFilterProps {
  facetBy: FacetBy;
  setFacetBy: (value: FacetBy) => void;
  makeAllFacetsVisible: () => void;
  makeAllFacetsInvisible: () => void;
  anyFacetsCollapsed: boolean;
}

export const FacetByFilter = ({
  facetBy,
  setFacetBy,
  makeAllFacetsVisible,
  makeAllFacetsInvisible,
  anyFacetsCollapsed,
}: FacetByFilterProps) => {
  const FacetByOptions: Array<FacetBy> = ["None", "Printing", "Source"];
  const facetByOptions = useMemo(
    () =>
      FacetByOptions.map((option) => ({
        value: option,
        label: option,
        checked: option === facetBy,
      })),
    [facetBy]
  );

  return (
    <>
      <Form.Label>Group by</Form.Label>
      <StyledDropdownTreeSelect
        data={facetByOptions}
        onChange={(currentNode) => {
          setFacetBy(currentNode.value as FacetBy);
          makeAllFacetsVisible();
        }}
        mode="radioSelect"
        inlineSearchInput
      />
      {facetBy !== "None" && (
        <div className="d-grid mt-2">
          <Button
            onClick={() =>
              anyFacetsCollapsed
                ? makeAllFacetsVisible()
                : makeAllFacetsInvisible()
            }
          >
            <RightPaddedIcon
              bootstrapIconName={`arrows-${
                anyFacetsCollapsed ? "expand" : "collapse"
              }`}
            />{" "}
            {anyFacetsCollapsed ? "Expand" : "Collapse"} All
          </Button>
        </div>
      )}
    </>
  );
};
