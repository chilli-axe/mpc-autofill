import React from "react";
import Table from "react-bootstrap/Table";
import styled, { css } from "styled-components";

// TODO: there's a lot of repetition in these styles. needs to be cleaned up later.

const TableWrapper = styled.div`
  max-width: 100%;
  overflow-x: scroll;
`;

const BorderedTable = styled(Table)<{
  $uniformWidth?: boolean;
  $bordered?: boolean;
}>`
  table-layout: ${(props) => (props.$uniformWidth ? "fixed" : "auto")};
  ${(props) =>
    props.$bordered &&
    css`
      border-style: solid;
      border-color: #333333;
      border-width: 1px;
    `}
`;

const ColumnHeader = styled.th<{
  $cols?: number | undefined;
  $centred?: boolean;
}>`
  width: ${(props) => (props.$cols != null ? 100 / (props.$cols ?? 1) : 0)}%;
  text-align: ${(props) => (props.$centred ? "center" : "left")};
`;

const ColumnData = styled.td<{
  $cols?: number | undefined;
  $centred?: boolean;
  $bordered?: boolean;
}>`
  width: ${(props) => (props.$cols != null ? 100 / (props.$cols ?? 1) : 0)}%;
  text-align: ${(props) => (props.$centred ? "center" : "left")};
  ${(props) =>
    props.$bordered &&
    css`
      border-style: solid;
      border-color: #333333;
      border-width: 1px;
    `}
`;

export function AutofillTable({
  headers,
  data,
  bordered = false,
  centred = true,
  uniformWidth = true,
  hover = false,
  columnLabels = false,
}: {
  headers: Array<string>;
  data: Array<Array<string | number | React.ReactElement | null | undefined>>;
  bordered?: boolean;
  centred?: boolean;
  uniformWidth?: boolean;
  hover?: boolean;
  columnLabels?: boolean;
}) {
  return (
    <TableWrapper>
      <BorderedTable
        $uniformWidth={uniformWidth}
        $bordered={bordered}
        hover={hover}
      >
        {headers.length > 0 && (
          <thead>
            {headers.map((header, headerIndex) => (
              <ColumnHeader
                key={`autofill-table-header-${headerIndex}`}
                scope="col"
                $cols={uniformWidth ? headers.length : undefined}
                $centred={centred}
              >
                {header}
              </ColumnHeader>
            ))}
          </thead>
        )}
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={`autofill-table-row-${rowIndex}`}>
              {row.map((value, columnIndex) => {
                const isLabel = columnLabels && columnIndex === 0;
                const CellElement = isLabel ? ColumnHeader : ColumnData;
                return (
                  <CellElement
                    scope={isLabel ? "row" : undefined}
                    key={`autofill-table-cell-${rowIndex}/${columnIndex}`}
                    $cols={uniformWidth ? row.length : undefined}
                    $centred={centred}
                    $bordered={!isLabel && bordered}
                  >
                    {value}
                  </CellElement>
                );
              })}
            </tr>
          ))}
        </tbody>
      </BorderedTable>
    </TableWrapper>
  );
}
