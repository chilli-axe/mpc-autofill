import Form from "react-bootstrap/Form";

import { CardTypePrefixes } from "@/common/constants";
import { StyledDropdownTreeSelect } from "@/common/StyledDropdownTreeSelect";
import { CardType } from "@/common/types";

interface CardTypeFilterProps {
  cardTypes: Array<CardType>;
  setCardTypes: (value: Array<CardType>) => void;
}

export const CardTypeFilter = ({
  cardTypes,
  setCardTypes,
}: CardTypeFilterProps) => {
  return (
    <>
      <Form.Label htmlFor="selectTypes">
        Select which card types to include
      </Form.Label>
      <StyledDropdownTreeSelect
        data={Object.values(CardTypePrefixes).map((cardType) => ({
          label: cardType[0].toUpperCase() + cardType.slice(1).toLowerCase(),
          value: cardType,
          checked: cardTypes.includes(cardType),
        }))}
        onChange={(currentNode, selectedNodes) =>
          setCardTypes(selectedNodes.map((item) => item.value as CardType))
        }
        inlineSearchInput
      />
    </>
  );
};
