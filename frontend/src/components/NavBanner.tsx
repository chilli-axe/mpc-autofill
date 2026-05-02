import React from "react";
import Nav from "react-bootstrap/Nav";

import {} from "@/common/constants";
import {
  NavPillButtonHeight,
  NavUnderlineButtonHeight,
} from "@/common/constants";

import { RightPaddedIcon } from "./icon";

export interface NavBannerItem<T extends string> {
  key: T;
  label: string | React.ReactElement;
  disabled?: boolean;
  bootstrapIconName?: string;
}

interface NavBannerProps<T extends string> {
  variant: "pills" | "underline";
  items: Array<NavBannerItem<T>>;
}

export const NavBanner = <T extends string>({
  items,
  variant,
}: NavBannerProps<T>) => {
  return (
    <Nav justify variant={variant}>
      {items.map(({ key, label, disabled = false, bootstrapIconName }) => (
        <Nav.Item
          key={key}
          style={{
            height:
              (variant === "pills"
                ? NavPillButtonHeight
                : NavUnderlineButtonHeight) + "px",
          }}
        >
          <Nav.Link disabled={disabled} eventKey={key}>
            {bootstrapIconName && (
              <RightPaddedIcon bootstrapIconName={bootstrapIconName} />
            )}
            {label}
          </Nav.Link>
        </Nav.Item>
      ))}
    </Nav>
  );
};
