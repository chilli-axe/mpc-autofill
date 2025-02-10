/**
 * A toggle to configure how the search engine matches queries to Cards - either precise or fuzzy (forgiving),
 * and whether or not search settings should apply to cardbacks.
 * This component forms part of the Search Settings modal.
 */

import React from "react";
import Container from "react-bootstrap/Container";
// @ts-ignore: https://github.com/arnthor3/react-bootstrap-toggle/issues/21
import Toggle from "react-bootstrap-toggle";

import { ToggleButtonHeight } from "@/common/constants";
import { SearchTypeSettings as SearchTypeSettingsType } from "@/common/types";

interface SearchTypeSettingsProps {
  searchTypeSettings: SearchTypeSettingsType;
  setSearchTypeSettings: {
    (newSearchTypeSettings: SearchTypeSettingsType): void;
  };
  enableFiltersApplyToCardbacks?: boolean;
}

export function SearchTypeSettings({
  searchTypeSettings,
  setSearchTypeSettings,
  enableFiltersApplyToCardbacks = true,
}: SearchTypeSettingsProps) {
  return (
    <Container className="px-1">
      <h5>Search Type</h5>
      Configure how closely the search results should match your query.
      <br />
      <br />
      <Toggle
        onClick={() =>
          setSearchTypeSettings({
            ...searchTypeSettings,
            fuzzySearch: !searchTypeSettings.fuzzySearch,
          })
        }
        on="Fuzzy (Forgiving) Search"
        onClassName="flex-centre"
        off="Precise Search"
        offClassName="flex-centre"
        onstyle="success"
        offstyle="info"
        width={100 + "%"}
        size="md"
        height={ToggleButtonHeight + "px"}
        active={searchTypeSettings.fuzzySearch}
      />
      {enableFiltersApplyToCardbacks && (
        <>
          <br />
          <br />
          <Toggle
            onClick={() =>
              setSearchTypeSettings({
                ...searchTypeSettings,
                filterCardbacks: !searchTypeSettings.filterCardbacks,
              })
            }
            on="Filters Apply to Cardbacks"
            onClassName="flex-centre"
            off="Include All Cardbacks"
            offClassName="flex-centre"
            onstyle="success"
            offstyle="info"
            width={100 + "%"}
            size="md"
            height={ToggleButtonHeight + "px"}
            active={searchTypeSettings.filterCardbacks}
          />
        </>
      )}
    </Container>
  );
}
