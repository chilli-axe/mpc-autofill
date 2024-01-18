import React from "react";
import styled from "styled-components";

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
