import React from "react";
import { UAParser } from "ua-parser-js";

import { ProjectName } from "@/common/constants";
import { Jumbotron } from "@/components/jumbotron";

export function MobileStatus() {
  const ua = UAParser();
  return ua.device.type === "mobile" ? (
    <Jumbotron variant="primary">
      It seems like you&apos;re on a mobile device! The {ProjectName} executable
      that auto-fills your order requires a desktop computer.
    </Jumbotron>
  ) : null;
}
