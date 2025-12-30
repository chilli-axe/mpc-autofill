import { css } from "@emotion/react";
import styled from "@emotion/styled";
import React from "react";
import Table from "react-bootstrap/Table";

// TODO: there's a lot of repetition in these styles. needs to be cleaned up later.

type Alignment = "left" | "center" | "right";

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
  $alignment?: Alignment;
}>`
  width: ${(props) => (props.$cols != null ? 100 / (props.$cols ?? 1) : 0)}%;
  text-align: ${(props) => props.$alignment};
`;

const ColumnData = styled.td<{
  $cols?: number | undefined;
  $alignment?: Alignment;
  $bordered?: boolean;
}>`
  width: ${(props) => (props.$cols != null ? 100 / (props.$cols ?? 1) : 0)}%;
  text-align: ${(props) => props.$alignment};
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
  alignment = "center",
  uniformWidth = true,
  hover = false,
  columnLabels = false,
}: {
  headers: Array<string>;
  data: Array<Array<string | number | React.ReactElement | null | undefined>>;
  bordered?: boolean;
  alignment?: Alignment | Array<Alignment>;
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
        variant="secondary"
      >
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header, headerIndex) => (
                <ColumnHeader
                  key={`autofill-table-header-${headerIndex}`}
                  scope="col"
                  $cols={uniformWidth ? headers.length : undefined}
                  $alignment={
                    Array.isArray(alignment)
                      ? alignment[headerIndex]
                      : alignment
                  }
                >
                  {header}
                </ColumnHeader>
              ))}
            </tr>
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
                    $alignment={
                      Array.isArray(alignment)
                        ? alignment[columnIndex]
                        : alignment
                    }
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
