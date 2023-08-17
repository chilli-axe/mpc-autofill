/**
 * This module contains some styled components for consistent presentation throughout the app.
 */

import React from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";

export const TableWrapper = styled.div`
  max-width: 100%;
  overflow-x: scroll;
`;

export const AutoLayoutTable = styled(Table)`
  table-layout: auto;
`;

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
