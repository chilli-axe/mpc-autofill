/**
 * A series of numeric range filters which allow control over which Cards are included in search results.
 * Users can filter on a DPI range and set a maximum allowable file size.
 * This component forms part of the Search Settings modal.
 */

import React from "react";
require("react-dropdown-tree-select/dist/styles.css");

import { FilterSettings as FilterSettingsType } from "@/common/types";

import { DPIFilter } from "../filters/DPIFilter";
import { LanguageFilter } from "../filters/LanguageFilter";
import { SizeFilter } from "../filters/SizeFilter";
import { TagFilter } from "../filters/TagFilter";

interface FilterSettingsProps {
  filterSettings: FilterSettingsType;
  setFilterSettings: {
    (newFilterSettings: FilterSettingsType): void;
  };
  minDPILowerBound?: number;
  maxDPIUpperBound?: number;
  maxSizeUpperBound?: number;
  allowedLanguages?: Array<string>;
  showBoilerplate?: boolean;
}

export function FilterSettings({
  filterSettings,
  setFilterSettings,
  minDPILowerBound,
  maxDPIUpperBound,
  maxSizeUpperBound,
  allowedLanguages,
  showBoilerplate = true,
}: FilterSettingsProps) {
  return (
    <>
      {showBoilerplate && (
        <>
          <h5>Filters</h5>
          Configure the DPI (dots per inch) and file size ranges the search
          results must be within.
          <br />
          At a fixed physical size, a higher DPI yields a higher resolution
          print.
          <br />
          MakePlayingCards prints cards up to <b>800 DPI</b>, meaning an 800 DPI
          print and a 1200 DPI print will <b>look the same</b>.
          <br />
          <br />
        </>
      )}
      <DPIFilter
        filterSettings={filterSettings}
        setFilterSettings={setFilterSettings}
        minDPILowerBound={minDPILowerBound}
        maxDPIUpperBound={maxDPIUpperBound}
      />
      <SizeFilter
        filterSettings={filterSettings}
        setFilterSettings={setFilterSettings}
        maxSizeUpperBound={maxSizeUpperBound}
      />
      <LanguageFilter
        filterSettings={filterSettings}
        setFilterSettings={setFilterSettings}
        allowedLanguages={allowedLanguages}
      />
      <TagFilter
        filterSettings={filterSettings}
        setFilterSettings={setFilterSettings}
      />
    </>
  );
}
