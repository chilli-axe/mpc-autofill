import Head from "next/head";
import Link from "next/link";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";

import { ProjectName } from "@/common/constants";
import { DynamicLogo } from "@/features/ui/dynamicLogo";
import Footer from "@/features/ui/footer";
import Layout from "@/features/ui/layout";

function JumpIntoEditorButton() {
  return (
    <Row className="justify-content-center">
      <Col xl={6} lg={6} md={8} sm={12} xs={12}>
        <Link href="/editor" passHref legacyBehavior>
          <div className="d-grid gap-0">
            <Button>Jump into the project editor</Button>
          </div>
        </Link>
      </Col>
    </Row>
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
        <Footer />
      </Layout>
    </>
  );
}
