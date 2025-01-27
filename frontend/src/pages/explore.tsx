import Head from "next/head";
import React, { useState } from "react";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import {
  FilterSettings,
  SearchSettings,
  SearchTypeSettings,
  SourceSettings,
  useAppSelector,
} from "@/common/types";
import { RightPaddedIcon } from "@/components/icon";
import { NoBackendDefault } from "@/components/NoBackendDefault";
import ProjectEditor from "@/components/ProjectEditor";
import { FilterSettings as FilterSettingsElement } from "@/features/searchSettings/FilterSettings";
import { SearchTypeSettings as SearchTypeSettingsElement } from "@/features/searchSettings/SearchTypeSettings";
import { SourceSettings as SourceSettingsElement } from "@/features/searchSettings/SourceSettings";
import Footer from "@/features/ui/Footer";
import { ProjectContainer } from "@/features/ui/Layout";
import { useBackendConfigured } from "@/store/slices/backendSlice";
import { getDefaultSearchSettings } from "@/store/slices/SearchSettingsSlice";
import { selectSourceDocuments } from "@/store/slices/sourceDocumentsSlice";
require("bootstrap-icons/font/bootstrap-icons.css");

function ExploreOrDefault() {
  // TODO: investigate performance of below
  const maybeSourceDocuments = useAppSelector(selectSourceDocuments); // TODO: race condition
  const defaultSettings = getDefaultSearchSettings(maybeSourceDocuments ?? []);
  const [localSearchTypeSettings, setLocalSearchTypeSettings] =
    useState<SearchTypeSettings>(defaultSettings.searchTypeSettings);
  const [localSourceSettings, setLocalSourceSettings] =
    useState<SourceSettings>(defaultSettings.sourceSettings);
  const [localFilterSettings, setLocalFilterSettings] =
    useState<FilterSettings>(defaultSettings.filterSettings);

  const backendConfigured = useBackendConfigured();
  return backendConfigured ? (
    <>
      <h1>Explore</h1>
      <Form.Label htmlFor="searchQueryText">Search Query</Form.Label>
      <Form.Control aria-describedby="searchQueryText" />
      <br />
      <Row>
        <Col>
          <SearchTypeSettingsElement
            searchTypeSettings={localSearchTypeSettings}
            setSearchTypeSettings={setLocalSearchTypeSettings}
          />
        </Col>
        <Col>
          <FilterSettingsElement
            filterSettings={localFilterSettings}
            setFilterSettings={setLocalFilterSettings}
          />
        </Col>
        <Col>
          <SourceSettingsElement
            sourceSettings={localSourceSettings}
            setSourceSettings={setLocalSourceSettings}
          />
        </Col>
      </Row>
      <hr />
    </>
  ) : (
    <NoBackendDefault />
  );
}

export default function Explore() {
  return (
    <ProjectContainer gutter={0}>
      <Head>
        <title>Explore</title>{" "}
        <meta
          name="description"
          // content={`${ProjectName}&apos;'s rich project editor.`}
        />
      </Head>
      <ExploreOrDefault />
      <Footer />
    </ProjectContainer>
  );
}
