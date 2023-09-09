/**
 * A series of numeric range filters which allow control over which Cards are included in search results.
 * Users can filter on a DPI range and set a maximum allowable file size.
 * This component forms part of the Search Settings modal.
 */

import React from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { MultiSelect } from "react-multi-select-component";
import styled from "styled-components";

import { useGetLanguagesQuery, useGetTagsQuery } from "@/app/api";
import {
  DPIStep,
  MaximumDPI,
  MaximumSize,
  MinimumDPI,
  SizeStep,
} from "@/common/constants";
import { FilterSettings as FilterSettingsType } from "@/common/types";

const StyledMultiSelect = styled(MultiSelect)`
  color: black;
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
  }));
  const languageOptionsByCode = Object.fromEntries(
    languageOptions.map((row) => [row.value, row])
  );
  const tagOptions = (getTagsQuery.data ?? []).map((tag) => ({
    label: tag.name,
    value: tag.name,
  }));

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
      <StyledMultiSelect
        options={languageOptions}
        disableSearch={true}
        isLoading={getLanguagesQuery.isFetching}
        value={filterSettings.languages
          .map((code) => languageOptionsByCode[code])
          .filter((row) => row != null)}
        onChange={(data: Array<{ label: string; value: string }>) => {
          setFilterSettings({
            ...filterSettings,
            languages: data.map((row) => row.value),
          });
        }}
        labelledBy="selectLanguage"
      />
      <Form.Label htmlFor="selectTags">
        Select tags which cards must have
      </Form.Label>
      <StyledMultiSelect
        options={tagOptions}
        disableSearch={true}
        isLoading={getTagsQuery.isFetching}
        value={filterSettings.includesTags.map((tag) => ({
          label: tag,
          value: tag,
        }))}
        onChange={(data: Array<{ label: string; value: string }>) => {
          const selectedTags = data.map((row) => row.value);
          setFilterSettings({
            ...filterSettings,
            includesTags: selectedTags,
            excludesTags: filterSettings.excludesTags.filter(
              (tag) => !selectedTags.includes(tag)
            ),
          });
        }}
        labelledBy="selectTags"
      />
      <Form.Label htmlFor="selectTags">
        Select tags which cards must <b>not</b> have
      </Form.Label>
      <StyledMultiSelect
        options={tagOptions}
        disableSearch={true}
        isLoading={getTagsQuery.isFetching}
        value={filterSettings.excludesTags.map((tag) => ({
          label: tag,
          value: tag,
        }))}
        onChange={(data: Array<{ label: string; value: string }>) => {
          const selectedTags = data.map((row) => row.value);
          setFilterSettings({
            ...filterSettings,
            excludesTags: selectedTags,
            includesTags: filterSettings.includesTags.filter(
              (tag) => !selectedTags.includes(tag)
            ),
          });
        }}
        labelledBy="selectTags"
      />
    </>
  );
}
