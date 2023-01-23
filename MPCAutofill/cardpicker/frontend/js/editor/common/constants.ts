export type CardType = "CARD" | "CARDBACK" | "TOKEN";
export const Card: CardType = "CARD";
export const Cardback: CardType = "CARDBACK";
export const Token: CardType = "TOKEN";

export const CardTypePrefixes = {
  "": Card,
  b: Cardback,
  t: Token,
};

export type Faces = "front" | "back";
export const Front: Faces = "front";
export const Back: Faces = "back";

export interface SearchQuery {
  query: string | null;
  card_type: CardType;
}

export const MinimumDPI = 0;
export const MaximumDPI = 1500;
export const DPIStep = 50;
