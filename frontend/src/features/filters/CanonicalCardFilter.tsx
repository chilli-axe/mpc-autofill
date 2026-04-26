// TODO: this file was slopped together by claude, could do with a careful read and tidy up.

import { useCallback, useMemo, useState } from "react";
import Form from "react-bootstrap/Form";
import { TreeNode } from "react-dropdown-tree-select";

import { Printing, Unknown } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { useAppSelector } from "@/common/types";
import { selectCardDocumentsByIdentifiers } from "@/store/slices/cardDocumentsSlice";

/**
 * Resolve the flat list of selected tree nodes from the printing dropdown into
 * a deduplicated array of Printing objects.
 *
 * The library may include both a parent expansion node and its children in
 * selectedNodes when all children are checked, so deduplication is required.
 */
export function resolveSelectedPrintings(
  selectedNodes: Array<{ value: string }>,
  expansionMap: Map<string, { code: string; numbers: Set<string> }>
): Array<Printing> {
  const printingMap = new Map<string, Printing>();
  for (const node of selectedNodes) {
    const value = node.value as string;
    if (value === Unknown) {
      printingMap.set(`${Unknown}|${Unknown}`, {
        expansionCode: Unknown,
        collectorNumber: Unknown,
      });
    } else if (expansionMap.has(value)) {
      // Parent expansion node — expand to all its collector numbers
      const expansion = expansionMap.get(value)!;
      for (const collectorNumber of expansion.numbers) {
        printingMap.set(`${expansion.code}|${collectorNumber}`, {
          expansionCode: expansion.code,
          collectorNumber,
        });
      }
    } else {
      // Child node: value format is "${expansionCode} ${collectorNumber}"
      const spaceIdx = value.indexOf(" ");
      if (spaceIdx !== -1) {
        const expansionCode = value.substring(0, spaceIdx);
        const collectorNumber = value.substring(spaceIdx + 1);
        printingMap.set(`${expansionCode}|${collectorNumber}`, {
          expansionCode,
          collectorNumber,
        });
      }
    }
  }
  return Array.from(printingMap.values());
}

interface CanonicalCardFilterProps {
  imageIdentifiers: Array<string>;
  printings: Array<Printing>;
  setPrintings: (printings: Array<Printing>) => void;
  artists: Array<string>;
  setArtists: (printings: Array<string>) => void;
}

export const CanonicalCardFilter = ({
  imageIdentifiers,
  printings,
  setPrintings,
  artists,
  setArtists,
}: CanonicalCardFilterProps) => {
  const [expandedPrintingNodes, setExpandedPrintingNodes] = useState<
    Array<string>
  >([]);
  const cardDocumentsByIdentifier = useAppSelector((state) =>
    selectCardDocumentsByIdentifiers(state, imageIdentifiers)
  );
  const availableArtists = useMemo(() => {
    const artistSet = new Set<string>();
    let hasUnknown = false;
    Object.values(cardDocumentsByIdentifier).forEach((card) => {
      if (card == null) return;
      if (card.canonicalCard == null) {
        hasUnknown = true;
      } else {
        artistSet.add(card.canonicalCard.artist);
      }
    });
    const sorted = Array.from(artistSet).sort();
    if (hasUnknown) sorted.push(Unknown);
    return sorted;
  }, [cardDocumentsByIdentifier]);

  // Stable structure: expansion -> { name, collector numbers }; only recomputes when card documents change
  const availablePrintingExpansions = useMemo(() => {
    const expansionMap = new Map<
      string,
      { name: string; code: string; numbers: Set<string> }
    >();
    let hasUnknown = false;
    Object.values(cardDocumentsByIdentifier).forEach((card) => {
      if (card == null) return;
      if (card.canonicalCard == null) {
        hasUnknown = true;
      } else {
        const { expansionCode, expansionName, collectorNumber } =
          card.canonicalCard;
        if (!expansionMap.has(expansionCode)) {
          expansionMap.set(expansionCode, {
            name: expansionName,
            code: expansionCode,
            numbers: new Set(),
          });
        }
        expansionMap.get(expansionCode)!.numbers.add(collectorNumber);
      }
    });
    return { expansionMap, hasUnknown };
  }, [cardDocumentsByIdentifier]);

  const includesExpansionCode = (expansionCode: string): boolean =>
    printings.some((value) => expansionCode === value.expansionCode);
  const includesPrinting = (printing: Printing): boolean =>
    printings.some(
      (value) =>
        printing.expansionCode === value.expansionCode &&
        printing.collectorNumber === value.collectorNumber
    );

  // Tree node data for the dropdown, recomputed when checked/expanded state changes
  const availablePrintingOptions = useMemo(() => {
    const { expansionMap, hasUnknown } = availablePrintingExpansions;
    const nodes = Array.from(expansionMap.entries())
      .sort(([, a], [, b]) => a.name.localeCompare(b.name))
      .map(([expansionCode, { name, numbers }]) => {
        const allChildrenSelected = Array.from(numbers).every((n) =>
          includesPrinting({ expansionCode, collectorNumber: n })
        );
        const anyChildSelected = includesExpansionCode(expansionCode);
        return {
          label: `${name} [${expansionCode.toUpperCase()}]`,
          value: expansionCode,
          checked: allChildrenSelected,
          partial: anyChildSelected && !allChildrenSelected,
          expanded: expandedPrintingNodes.includes(expansionCode),
          children: Array.from(numbers)
            .sort()
            .map((collectorNumber) => ({
              label: collectorNumber,
              value: `${expansionCode} ${collectorNumber}`,
              checked: includesPrinting({ expansionCode, collectorNumber }),
            })),
        };
      });
    if (hasUnknown) {
      nodes.push({
        label: Unknown,
        value: Unknown,
        checked: printings.some(
          (p) => p.expansionCode === Unknown && p.collectorNumber === Unknown
        ),
        partial: false,
        expanded: false,
        children: [],
      });
    }
    return nodes;
  }, [availablePrintingExpansions, printings, expandedPrintingNodes]);

  const onPrintingNodeToggle = useCallback(
    (currentNode: TreeNode): void => {
      if (
        currentNode.expanded &&
        !expandedPrintingNodes.includes(currentNode.value)
      ) {
        setExpandedPrintingNodes([...expandedPrintingNodes, currentNode.value]);
      } else if (
        !currentNode.expanded &&
        expandedPrintingNodes.includes(currentNode.value)
      ) {
        setExpandedPrintingNodes(
          expandedPrintingNodes.filter((v) => v !== currentNode.value)
        );
      }
    },
    [expandedPrintingNodes]
  );

  return (
    <>
      {availablePrintingOptions.filter((printing) => printing.label !== Unknown)
        .length > 0 && (
        <div data-testid="printing-filter">
          <Form.Label>Canonical card printings</Form.Label>
          <StyledDropdownTreeSelect
            data={availablePrintingOptions}
            onChange={(_currentNode, selectedNodes) => {
              const { expansionMap } = availablePrintingExpansions;
              setPrintings(
                resolveSelectedPrintings(selectedNodes, expansionMap)
              );
            }}
            onNodeToggle={onPrintingNodeToggle}
            inlineSearchInput
          />
        </div>
      )}
      {availableArtists.filter((artist) => artist !== Unknown).length > 0 && (
        <div data-testid="artist-filter">
          <Form.Label>Canonical card artists</Form.Label>
          <StyledDropdownTreeSelect
            data={availableArtists.map((artist) => ({
              label: artist,
              value: artist,
              checked: artists.includes(artist),
            }))}
            onChange={(_currentNode, selectedNodes) =>
              setArtists(selectedNodes.map((node) => node.value))
            }
            inlineSearchInput
          />
        </div>
      )}
    </>
  );
};
