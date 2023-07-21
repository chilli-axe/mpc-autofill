import Head from "next/head";
import Link from "next/link";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import {
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectName,
} from "@/common/constants";
import { useAppSelector } from "@/common/types";
import {
  selectBackendURL,
  useProjectName,
} from "@/features/backend/backendSlice";
import { DynamicLogo } from "@/features/ui/dynamicLogo";
import Footer from "@/features/ui/footer";
import { ProjectContainer } from "@/features/ui/layout";

function JumpIntoEditorButton() {
  const backendURL = useAppSelector(selectBackendURL);
  return (
    <Row className="justify-content-center">
      <Col xl={6} lg={6} md={8} sm={12} xs={12}>
        {backendURL != null ? (
          <Link href="/editor" passHref legacyBehavior>
            <div className="d-grid gap-0">
              <Button>Jump into the project editor!</Button>
            </div>
          </Link>
        ) : (
          <p style={{ textAlign: "center" }}>
            Click the <b>Configure Server</b> button in the top-right to get
            started!
          </p>
        )}
      </Col>
    </Row>
  );
}

function ProjectOverview() {
  return (
    <>
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <h1>Self-Service Card Printing for Tabletop Gaming</h1>
          <ul>
            <li>
              {ProjectName} is the best way for individuals to have playtest
              cards professionally printed for casual tabletop gaming.
            </li>
            <li>
              It&apos;s fully open-source software (licensed under GPL-3) and
              all of its features will always be free.
            </li>
          </ul>
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
      </Row>
      <br />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <h1>Community-Driven Card Image Databases</h1>
          <ul>
            <li>
              Choose your favourite renders and artworks made by your community
              to bling out your project!
            </li>
            <li>
              Use our rich project editor to fine-tune exactly how you&apos;d
              like it to turn out.
            </li>
            <li>
              Browse the cards that creators in your community have added to the
              site recently.
            </li>
          </ul>
        </Col>
      </Row>
      <br />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}>
          <h1>
            Automatic Ordering with{" "}
            <a href={MakePlayingCardsURL} target="_blank">
              {MakePlayingCards}
            </a>
          </h1>
          <ul>
            <li>
              Our desktop tool will download all the images required for your
              order and automatically place your order with{" "}
              <a href={MakePlayingCardsURL} target="_blank">
                {MakePlayingCards}
              </a>
              , who will mail the cards right to your door!
            </li>
          </ul>
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
      </Row>
    </>
  );
}

export default function Index() {
  const projectName = useProjectName();
  return (
    <ProjectContainer>
      <Head>
        <title>{projectName}</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <br />
      <DynamicLogo />
      <br />
      <JumpIntoEditorButton />
      <hr />
      <ProjectOverview />
      <Footer />
    </ProjectContainer>
  );
}
