import styled from "@emotion/styled";
import React from "react";
import Nav from "react-bootstrap/Nav";

import {} from "@/common/constants";
import {
  NavPillButtonHeight,
  NavUnderlineButtonHeight,
} from "@/common/constants";

import { RightPaddedIcon } from "./icon";

const StyledNav = styled(Nav)<{ position?: "top" | "bottom" }>`
  box-shadow: 0
    ${({ position }) =>
      position === "top" ? -1 : position === "bottom" ? 1 : 0}px
    0 rgb(255, 255, 255, 50%) inset;
`;

export interface NavBannerItem<T extends string> {
  key: T;
  label: string | React.ReactElement;
  disabled?: boolean;
  bootstrapIconName?: string;
}

interface NavBannerProps<T extends string> {
  variant: "pills" | "underline";
  position?: "top" | "bottom";
  items: Array<NavBannerItem<T>>;
}

export const NavBanner = <T extends string>({
  items,
  variant,
  position,
}: NavBannerProps<T>) => {
  return (
    <StyledNav justify variant={variant} position={position}>
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
    </StyledNav>
  );
};
