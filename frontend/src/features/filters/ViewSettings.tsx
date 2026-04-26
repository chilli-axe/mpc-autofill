import { FavouritesSourceKey } from "@/common/constants";
import { FacetBy, useAppDispatch, useAppSelector } from "@/common/types";
import { selectSourceNamesByKey } from "@/store/slices/sourceDocumentsSlice";
import {
  makeAllFacetsInvisible,
  makeAllFacetsVisible,
  selectAnyFacetsCollapsed,
  selectCompressed,
  selectFacetBy,
  setCompressed,
  setFacetBy,
} from "@/store/slices/viewSettingsSlice";

import { CompressedFilter } from "./CompressedFilter";
import { FacetByFilter } from "./FacetByFilter";

interface ViewSettingsProps {}

export const ViewSettings = (props: ViewSettingsProps) => {
  const dispatch = useAppDispatch();
  const facetBy = useAppSelector(selectFacetBy);
  const compressed = useAppSelector(selectCompressed);
  const anyFacetsCollapsed = useAppSelector(selectAnyFacetsCollapsed);
  return (
    <>
      <FacetByFilter
        facetBy={facetBy}
        setFacetBy={(value: FacetBy) => dispatch(setFacetBy(value))}
        makeAllFacetsVisible={() => dispatch(makeAllFacetsVisible())}
        makeAllFacetsInvisible={() => dispatch(makeAllFacetsInvisible())}
        anyFacetsCollapsed={anyFacetsCollapsed}
      />
      <CompressedFilter
        compressed={compressed}
        setCompressed={() => dispatch(setCompressed(!compressed))}
      />
    </>
  );
};
