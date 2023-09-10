/**
 * A series of numeric range filters which allow control over which Cards are included in search results.
 * Users can filter on a DPI range and set a maximum allowable file size.
 * This component forms part of the Search Settings modal.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import DropdownTreeSelect, {
  TreeData,
  TreeNode,
} from "react-dropdown-tree-select";
require("react-dropdown-tree-select/dist/styles.css");
import styled from "styled-components";

import { useGetLanguagesQuery, useGetTagsQuery } from "@/app/api";
import {
  DPIStep,
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  SizeStep,
} from "@/common/constants";
import { Tag } from "@/common/types";
import { FilterSettings as FilterSettingsType } from "@/common/types";

const StyledDropdownTreeSelect = styled(DropdownTreeSelect)`
  .tag {
    color: black;
    background-color: #dddddd;
  }
  .tag-remove {
    color: #666666;
  }

  .dropdown-trigger {
    border-radius: 0.25rem;
    background-color: white;
  }
  .dropdown-content {
    border-radius: 0.25rem;
  }

  .search {
    background-color: white;
  }
  .search::placeholder {
    color: black;
  }

  .toggle {
    font: normal normal normal 12px/1 bootstrap-icons;
    top: 2px;
    left: 2px;
  }

  .toggle.collapsed::after {
    content: "\uF4FA";
  }

  .toggle.expanded::after {
    content: "\uF2E6";
  }

  color: black;

  .root {
    padding: 0;
    margin: 0;
  }
`;

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
  const getLanguagesQuery = useGetLanguagesQuery();
  const getTagsQuery = useGetTagsQuery();

  const languageOptions = (getLanguagesQuery.data ?? []).map((row) => ({
    label: row.name,
    value: row.code,
    checked: filterSettings.languages.includes(row.code),
  }));

  const [expandedNodes, setExpandedNodes] = useState<Array<string>>([]);
  const onNodeToggle = (currentNode: TreeNode): void => {
    /**
     * Note that controlling the checked status of tags through the data passed to the dropdown component
     * necessitates controlling the expanded/collapsed status of tags with children as well.
     * This appears to be because updating data in Redux forces the component to re-render in
     * its initial state where everything is collapsed.
     */

    if (currentNode.expanded && !expandedNodes.includes(currentNode.value)) {
      setExpandedNodes([...expandedNodes, currentNode.value]);
    } else if (
      !currentNode.expanded &&
      expandedNodes.includes(currentNode.value)
    ) {
      setExpandedNodes(
        expandedNodes.filter((node) => node != currentNode.value)
      );
    }
  };

  const getTagsTree = useCallback(
    (checkedTags: Array<string>): Array<TreeNode> => {
      /**
       * Recursively convert a `Tag` into a data structure usable by react-dropdown-tree-select.
       */

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
  const includesTagsTree = getTagsTree(filterSettings.includesTags);
  const excludesTagsTree = getTagsTree(filterSettings.excludesTags);

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
      <br />
      <br />
      Configure the languages and tags to filter the search results on.
      <br />
      <br />
      <Form.Label htmlFor="selectLanguage">Select languages</Form.Label>
      <StyledDropdownTreeSelect
        data={languageOptions}
        onChange={(currentNode, selectedNodes) => {
          setFilterSettings({
            ...filterSettings,
            languages: selectedNodes.map((row) => row.value),
          });
        }}
      />
      <Form.Label htmlFor="selectTags">
        Select tags which cards must have <b>at least one</b> of
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
      />
      <Form.Label htmlFor="selectTags">
        Select tags which cards must <b>not</b> have
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
      />
    </>
  );
}
