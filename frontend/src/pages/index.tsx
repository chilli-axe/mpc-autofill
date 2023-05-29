import Head from "next/head";
import Link from "next/link";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useSelector } from "react-redux";

import {
  MakePlayingCards,
  MakePlayingCardsURL,
  ProjectName,
} from "@/common/constants";
import { selectBackendURL } from "@/features/backend/backendSlice";
import { DynamicLogo } from "@/features/ui/dynamicLogo";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";

function JumpIntoEditorButton() {
  const backendURL = useSelector(selectBackendURL);
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
          <p>Body text to accompany heading 1</p>
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
      </Row>
      <br />
      <Row>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
        <Col lg={6} md={6} sm={12} xs={12}>
          <h1>Community-Driven Card Image Databases</h1>
          <p>Body text to accompany header 2</p>
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
          <p>Body text to accompany heading 3</p>
        </Col>
        <Col lg={6} md={6} sm={12} xs={12}></Col>
      </Row>
    </>
  );
}

export default function Index() {
  return (
    <>
      <Head>
        <title>{ProjectName}</title>
        <meta name="description" content="TODO" /> {/* TODO */}
      </Head>
      <Layout>
        <br />
        <DynamicLogo />
        <br />
        <JumpIntoEditorButton />
        <hr />
        <ProjectOverview />
        <Footer />
      </Layout>
    </>
  );
}
