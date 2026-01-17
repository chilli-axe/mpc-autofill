/**
 * This component is a container for the various toast alerts the store needs to raise.
 */

import Link from "next/link";
import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";

import { ProjectName } from "@/common/constants";
import {
  getGoogleAnalyticsConsent,
  setGoogleAnalyticsConsent,
} from "@/common/cookies";
import { Notification, useAppDispatch, useAppSelector } from "@/common/types";
import DisableSSR from "@/components/DisableSSR";
import { RightPaddedIcon } from "@/components/icon";
import {
  clearNotification,
  selectToastsNotifications,
} from "@/store/slices/toastsSlice";

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
    <Toast show={consent == undefined && !interacted} delay={3000}>
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

interface NotificationBodyProps {
  notification: Notification;
}

function InfoToastBody({ notification }: NotificationBodyProps) {
  return (
    <>
      <Toast.Header>
        <RightPaddedIcon bootstrapIconName="info-circle" />
        <strong className="me-auto">{notification.name}</strong>
      </Toast.Header>
      {notification.message && (
        <Toast.Body>
          <p>{notification.message}</p>
        </Toast.Body>
      )}
    </>
  );
}

function WarningToastBody({ notification }: NotificationBodyProps) {
  return (
    <>
      <Toast.Header>
        <RightPaddedIcon bootstrapIconName="exclamation-triangle" />
        <strong className="me-auto">{notification.name}</strong>
      </Toast.Header>
      {notification.message && (
        <Toast.Body>
          <p>{notification.message}</p>
        </Toast.Body>
      )}
    </>
  );
}

function ErrorToastBody({ notification }: NotificationBodyProps) {
  return (
    <>
      <Toast.Header>
        <RightPaddedIcon bootstrapIconName="exclamation-circle" />
        <strong className="me-auto">An Error Occurred</strong>
      </Toast.Header>
      <Toast.Body>
        <h6>{notification.name ?? "Unknown Error"}</h6>
        <p>We&apos;re sorry, but an error occurred while handling a request.</p>
        {notification.message != null && (
          <p>
            Error message: <i>{notification.message}</i>
          </p>
        )}
      </Toast.Body>
    </>
  );
}

function NotificationToastBody({ notification }: NotificationBodyProps) {
  switch (notification.level) {
    case "info":
      return <InfoToastBody notification={notification} />;
    case "warning":
      return <WarningToastBody notification={notification} />;
    case "error":
      return <ErrorToastBody notification={notification} />;
  }
}

function NotificationToast() {
  const notifications = useAppSelector(selectToastsNotifications);
  const dispatch = useAppDispatch();

  return (
    <>
      {Object.entries(notifications).map(([key, notification]) => (
        <Toast
          show={notification != null}
          delay={7000}
          autohide
          key={`${key}-toast`}
          onClose={() => dispatch(clearNotification(key))}
        >
          <NotificationToastBody notification={notification} />
        </Toast>
      ))}
    </>
  );
}

export function Toasts() {
  return (
    <DisableSSR>
      <ToastContainer position="bottom-start" className="p-3">
        <GoogleAnalyticsConsentToast />
        <NotificationToast />
      </ToastContainer>
    </DisableSSR>
  );
}
