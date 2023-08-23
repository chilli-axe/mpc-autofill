import Head from "next/head";
import React from "react";
import { Accordion } from "react-bootstrap";

import { useGetTagsQuery } from "@/app/api";
import {
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectName,
} from "@/common/constants";
import {
  useBackendConfigured,
  useProjectName,
} from "@/features/backend/backendSlice";
import {
  ContributionsPerSource,
  ContributionsSummary,
} from "@/features/contributions/contributions";
import Footer from "@/features/ui/footer";
import { ProjectContainer } from "@/features/ui/layout";
import { NoBackendDefault } from "@/features/ui/noBackendDefault";

function ContributionGuidelines() {
  const projectName = useProjectName();
  const getTagsQuery = useGetTagsQuery();

  return (
    <Accordion>
      <Accordion.Item eventKey="0">
        <Accordion.Header>Contribution Guidelines</Accordion.Header>
        <Accordion.Body>
          <h3>File Format</h3>
          <ul>
            <li>
              Image filetype must be either <code>png</code> (recommended) or{" "}
              <code>jpeg</code>.
            </li>
          </ul>
          <h3>Tagging</h3>
          <ul>
            <li>
              {ProjectName} will attempt to tag images when indexing them
              according to their names.
            </li>
            {!getTagsQuery.isFetching && getTagsQuery.data != null && (
              <li>
                {projectName} is configured with the following tags:
                <ul>
                  {getTagsQuery.data.map((tag: string) => (
                    <li key={tag}>
                      <code>{tag}</code>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            <li>
              Include tags in your file and folder names inside <code>[]</code>{" "}
              square brackets or inside <code>()</code> parentheses. Separate
              multiple tags with commas.
              <ul>
                <li>
                  For example, if a file was named{" "}
                  <code>Image A [NSFW, Full Art].png</code>, we would read the
                  tags <code>NSFW</code> and <code>Full Art</code>.
                </li>
                <li>
                  We would read the same tags if a file was named{" "}
                  <code>Image A (NSFW, Full Art).png</code>.
                </li>
              </ul>
            </li>
            <li>
              You may specify tags in folder names. If you do, all images within
              the folder will get those tags.
            </li>
          </ul>
          <h3>Languages</h3>
          <ul>
            <li>
              You may specify the language an image is written in inside{" "}
              <code>{"{}"}</code> curly brackets at the <b>start</b> of the file
              name, using the{" "}
              <a href="https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes">
                <b>ISO-639-1</b> nomenclature
              </a>
              .
              <ul>
                <li>
                  For example, if a file was named{" "}
                  <code>{"<DE>"} Image A.png</code>, we would read the language
                  as <b>German</b>.
                </li>
              </ul>
            </li>
            <li>
              {ProjectName} assumes that cards are written in English unless
              specified otherwise.
            </li>
            <li>
              You may specify a languages in folder names. If you do, all images
              within the folder are assumed to be that language unless specified
              otherwise.
            </li>
          </ul>
          <h3>Card Types</h3>
          <ul>
            <li>
              Store your token images in a folder called <code>Tokens</code>{" "}
              (anywhere in your repository).
            </li>
            <li>
              Store your cardback images in a folder called{" "}
              <code>Cardbacks</code> (anywhere in your repository).
            </li>
          </ul>
          <h3>Ignored Files</h3>
          <ul>
            <li>
              Prepend the names of any folders you don&apos;t want to be indexed
              by {ProjectName} with <code>!</code>
              &mdash; for example, <code>!Misc and Art</code>
            </li>
          </ul>
          <h3>Other Naming Conventions</h3>
          <ul>
            <li>
              When you have multiple versions of a card in the same folder, use
              parentheses to differentiate them &mdash; e.g.{" "}
              <code>Image A.png</code> and <code>Image A (Extended).png</code>
              <ul>
                <li>
                  If the text in parentheses (e.g. <code>Extended</code> in the
                  above example) doesn&apos;t match a tag, it will be ignored by
                  the search engine.
                </li>
                <li>
                  The first image (<code>Image A.png</code>) will be shown in
                  search results before the second image (
                  <code>Image A (Extended).png</code>).
                </li>
              </ul>
            </li>
            <li>
              If a card has multiple names, use an ampersand to separate them
              &mdash; for example, <code>Fire & Ice.png</code>
            </li>
          </ul>
          <h3>Restrictions</h3>
          <ul>
            <li>
              Limit your files to less than <b>30 MB</b> per image &mdash; this
              is the maximum that Google Scripts can return in one request and
              the maximum that{" "}
              <a href={MakePlayingCardsURL} target="_blank">
                {MakePlayingCards}
              </a>{" "}
              accepts, meaning the desktop client won&apos;t work with images
              that exceed this limit.
            </li>
          </ul>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}

function ContributionsOrDefault() {
  const backendConfigured = useBackendConfigured();
  return backendConfigured ? (
    <>
      <ContributionsSummary />
      <ContributionGuidelines />
      <br />
      <ContributionsPerSource />
      <Footer />
    </>
  ) : (
    <NoBackendDefault />
  );
}

export default function Contributions() {
  const projectName = useProjectName();
  return (
    <ProjectContainer>
      <Head>
        <title>{projectName} Contributions</title>
        <meta
          name="description"
          content={`A summary of the image contributors connected to ${ProjectName}.`}
        />
      </Head>
      <ContributionsOrDefault />
    </ProjectContainer>
  );
}
