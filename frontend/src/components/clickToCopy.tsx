import React, { useState } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import styled from "styled-components";

const ClickToCopyCode = styled.code`
  user-select: none;
  outline: solid 1px #ffffff00;
  transition: outline 0.2s ease-in-out;
  &:hover {
    outline-color: #ffffffff;
    cursor: pointer;
  }
`;

export function ClickToCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState<boolean>(false);
  const copyIdentifier = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <OverlayTrigger
      defaultShow={false}
      placement="top"
      overlay={
        <Tooltip id="image-identifier">
          {copied ? "Copied!" : "Click to copy"}
        </Tooltip>
      }
    >
      <ClickToCopyCode onClick={copyIdentifier}>{text}</ClickToCopyCode>
    </OverlayTrigger>
  );
}
