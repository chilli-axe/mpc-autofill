import Table from "react-bootstrap/Table";
import styled from "styled-components";

export const TableWrapper = styled.div`
  max-width: 100%;
  overflow-x: scroll;
`;

export const AutoLayoutTable = styled(Table)`
  table-layout: auto;
`;

export const BorderedTable = styled(Table)`
  border-style: solid;
  border-color: #333333;
  border-width: 1px;
`;
