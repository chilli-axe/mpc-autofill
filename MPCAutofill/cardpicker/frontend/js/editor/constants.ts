export enum CardTypes { // TODO: string literal
  Card = "CARD",
  Cardback = "CARDBACK",
  Token = "TOKEN",
}

export interface SearchQuery {
  query: string | null;
  card_type: CardTypes;
}

export type Faces = "front" | "back";
export const Front: Faces = "front";
export const Back: Faces = "back";

export const CardTypePrefixes = {
  "": CardTypes.Card,
  b: CardTypes.Cardback,
  t: CardTypes.Token,
};
