import { useMemo } from "react";
import { TreeNode } from "react-dropdown-tree-select";

import { SortByOptions } from "@/common/constants";
import { SortBy } from "@/common/schema_types";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";

const getSortByOptions = (sortBy: SortBy | undefined) =>
  Object.entries(SortByOptions).map(([value, label]) => ({
    value,
    label,
    checked: value === sortBy,
  }));

interface SortByFilterProps {
  sortBy: SortBy;
  setSortBy: (value: SortBy) => void;
}

export const SortByFilter = ({ sortBy, setSortBy }: SortByFilterProps) => {
  const sortByOptions = useMemo(() => getSortByOptions(sortBy), [sortBy]);

  const onChange = (currentNode: TreeNode, selectedNodes: Array<TreeNode>) => {
    if (selectedNodes.length === 1) {
      setSortBy(selectedNodes[0].value as SortBy);
    }
  };

  return (
    <StyledDropdownTreeSelect
      data={sortByOptions}
      onChange={onChange}
      mode="radioSelect"
      inlineSearchInput
    />
  );
};

interface NullableSortByFilterProps {
  sortBy: SortBy | undefined;
  setSortBy: (value: SortBy | undefined) => void;
}

export const NullableSortByFilter = ({
  sortBy,
  setSortBy,
}: NullableSortByFilterProps) => {
  const sortByOptions = useMemo(() => getSortByOptions(sortBy), [sortBy]);

  const onChange = (currentNode: TreeNode, selectedNodes: Array<TreeNode>) => {
    if (selectedNodes.length === 0) {
      setSortBy(undefined);
    } else if (selectedNodes.length === 1) {
      setSortBy(selectedNodes[0].value as SortBy);
    }
  };

  return (
    <StyledDropdownTreeSelect
      data={sortByOptions}
      onChange={onChange}
      mode="radioSelect"
      inlineSearchInput
    />
  );
};
