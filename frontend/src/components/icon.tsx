import styled from "@emotion/styled";
import classnames from "classnames";
import React from "react";

export const RightPaddedI = styled.i`
  padding-right: 0.5em;
`;

export const RightPaddedIcon = ({
  bootstrapIconName,
}: {
  bootstrapIconName: string;
}) => {
  return <RightPaddedI className={`bi bi-${bootstrapIconName}`} />;
};

export const Icon = ({
  bootstrapIconName,
  className,
}: {
  bootstrapIconName: string;
  className?: string;
}) => {
  return <i className={classnames(className, `bi bi-${bootstrapIconName}`)} />;
};
