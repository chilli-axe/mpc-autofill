import React from "react";
import Alert from "react-bootstrap/Alert";
import { UAParser } from "ua-parser-js";

import { ProjectName } from "@/common/constants";

export function MobileStatus() {
  const ua = UAParser();
  return ua.device.type === "mobile" ? (
    <Alert variant="primary">
      It seems like you&apos;re on a mobile device! The {ProjectName} executable
      that auto-fills your order requires a desktop computer.
    </Alert>
  ) : (
    <></>
  );
}
