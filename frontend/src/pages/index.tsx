import Head from "next/head";
import Link from "next/link";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import {
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectName,
} from "@/common/constants";
import {
  useBackendConfigured,
  useProjectName,
} from "@/features/backend/backendSlice";
import { DynamicLogo } from "@/features/ui/dynamicLogo";
import Footer from "@/features/ui/footer";
import { ProjectContainer } from "@/features/ui/layout";

function JumpIntoEditorButton() {
  const backendConfigured = useBackendConfigured();
  return (
    <Row className="justify-content-center">
      <Col xl={6} lg={6} md={8} sm={12} xs={12}>
        {backendConfigured ? (
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
              {ProjectName} is the easiest way to print professional-quality
              playtest cards for kitchen-table tabletop gaming with
              MakePlayingCards (MPC).
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
        <title>{`${projectName}`}</title>
        <meta
          name="description"
          content="The easiest way to print professional-quality playtest cards for kitchen-table tabletop gaming with MakePlayingCards (MPC)."
        />
      </Head>
      <br />
      {process.env.NEXT_PUBLIC_IMAGE_CDN_URL != null && (
        <Alert variant="info">
          Howdy! I&apos;m testing an experimental feature for image loading at
          the moment.
          <br />
          If you noticed any issues, please create an issue on{" "}
          <a
            href="https://github.com/chilli-axe/mpc-autofill/issues"
            target="_blank"
          >
            the GitHub repo
          </a>
          . Thanks for your patience!
        </Alert>
      )}
      <DynamicLogo />
      <br />
      <JumpIntoEditorButton />
      <hr />
      <ProjectOverview />
      <Footer />
    </ProjectContainer>
  );
}
