import { useCallback, useMemo, useState } from "react";
import Form from "react-bootstrap/Form";
import { TreeNode } from "react-dropdown-tree-select";

import { FilterSettings, Tag } from "@/common/schema_types";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useGetTagsQuery } from "@/store/api";

interface TagFilterProps {
  filterSettings: FilterSettings;
  setFilterSettings: (value: FilterSettings) => void;
}

export const TagFilter = ({
  filterSettings,
  setFilterSettings,
}: TagFilterProps) => {
  const getTagsQuery = useGetTagsQuery();

  const [expandedNodes, setExpandedNodes] = useState<Array<string>>([]);

  /**
   * Note that controlling the checked status of tags through the data passed to the dropdown component
   * necessitates controlling the expanded/collapsed status of tags with children as well.
   * This appears to be because updating data in Redux forces the component to re-render in
   * its initial state where everything is collapsed.
   */
  const onNodeToggle = useMemo(
    () =>
      (currentNode: TreeNode): void => {
        if (
          currentNode.expanded &&
          !expandedNodes.includes(currentNode.value)
        ) {
          setExpandedNodes([...expandedNodes, currentNode.value]);
        } else if (
          !currentNode.expanded &&
          expandedNodes.includes(currentNode.value)
        ) {
          setExpandedNodes(
            expandedNodes.filter((node) => node != currentNode.value)
          );
        }
      },
    [expandedNodes]
  );

  /**
   * Recursively convert a `Tag` into a data structure usable by react-dropdown-tree-select.
   */
  const getTagsTree = useCallback(
    (checkedTags: Array<string>): Array<TreeNode> => {
      const processTag = (tag: Tag): TreeNode => {
        return {
          label: tag.name,
          value: tag.name,
          checked: checkedTags.includes(tag.name),
          expanded: expandedNodes.includes(tag.name),
          children: tag.children.map((childTag) => processTag(childTag)),
        };
      };
      return (getTagsQuery.data ?? []).map((tag) => processTag(tag));
    },
    [getTagsQuery.data, expandedNodes]
  );

  const includesTagsTree = useMemo(
    () => getTagsTree(filterSettings.includesTags),
    [getTagsTree, filterSettings.includesTags]
  );
  const excludesTagsTree = useMemo(
    () => getTagsTree(filterSettings.excludesTags),
    [getTagsTree, filterSettings.excludesTags]
  );

  return (
    <>
      <Form.Label htmlFor="selectTags">
        Tags which cards must have <b>at least one</b> of
      </Form.Label>
      <StyledDropdownTreeSelect
        data={includesTagsTree}
        onChange={(currentNode, selectedNodes) => {
          const selectedTags = selectedNodes.map((node) => node.value);
          setFilterSettings({
            ...filterSettings,
            includesTags: selectedTags,
            excludesTags: filterSettings.excludesTags.filter(
              (tag) => !selectedTags.includes(tag)
            ),
          });
        }}
        onNodeToggle={onNodeToggle}
        inlineSearchInput
      />
      <Form.Label htmlFor="selectTags">
        Tags which cards must <b>not</b> have
      </Form.Label>
      <StyledDropdownTreeSelect
        data={excludesTagsTree}
        onChange={(currentNode, selectedNodes) => {
          const selectedTags = selectedNodes.map((node) => node.value);
          setFilterSettings({
            ...filterSettings,
            excludesTags: selectedTags,
            // TODO: account for parents here. you shouldn't be able to include a child but exclude a parent.
            includesTags: filterSettings.includesTags.filter(
              (tag) => !selectedTags.includes(tag)
            ),
          });
        }}
        onNodeToggle={onNodeToggle}
        inlineSearchInput
      />
    </>
  );
};
