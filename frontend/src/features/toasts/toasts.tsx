/**
 * This component is a container for the various toast alerts the app needs to raise.
 */

import React, { useState } from "react";
import Toast from "react-bootstrap/Toast";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import ToastContainer from "react-bootstrap/ToastContainer";
import Link from "next/link";
import {
  getGoogleAnalyticsConsent,
  setGoogleAnalyticsConsent,
} from "@/common/cookies";
import DisableSSR from "@/features/ui/disableSSR";
import { ProjectName } from "@/common/constants";

function GoogleAnalyticsConsentToast() {
  const consent = getGoogleAnalyticsConsent();
  const [interacted, setInteracted] = useState<boolean>(false);

  const giveConsent = () => {
    setGoogleAnalyticsConsent(true);
    setInteracted(true);
  };
  const denyConsent = () => {
    setGoogleAnalyticsConsent(false);
    setInteracted(true);
  };

  return (
    <Toast
      show={consent == undefined && !interacted}
      delay={3000}
      animation={true}
    >
      <Toast.Header closeButton={false}>
        <strong className="me-auto">Cookie Usage</strong>
      </Toast.Header>
      <Toast.Body>
        <p>
          {ProjectName} uses cookies for remembering your search settings, and
          for collecting analytics data to help improve the site. Your data is
          never shared with anyone. Would you like to opt out of analytics
          cookies?
        </p>
        <p>
          View our privacy policy <Link href="/about">here</Link>.
        </p>

        <div className="mt-2 pt-2 border-top">
          <Row>
            <Col className="d-grid gap-0">
              <Button variant="outline-info" size="sm" onClick={denyConsent}>
                Opt out
              </Button>
            </Col>
            <Col className="d-grid gap-0">
              <Button variant="primary" size="sm" onClick={giveConsent}>
                That&apos;s fine!
              </Button>
            </Col>
          </Row>
        </div>
      </Toast.Body>
    </Toast>
  );
}

export function Toasts() {
  return (
    <DisableSSR>
      <ToastContainer position="top-start">
        <GoogleAnalyticsConsentToast />
        {/* TODO: error message toasts here */}
      </ToastContainer>
    </DisableSSR>
  );
}
