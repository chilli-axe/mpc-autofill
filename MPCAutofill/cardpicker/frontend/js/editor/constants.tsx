export enum CardTypes {
  Card = "CARD",
  Cardback = "CARDBACK",
  Token = "TOKEN",
}

export interface SearchQuery {
  query: string;
  card_type: CardTypes;
}

export enum Faces {
  Front = "front",
  Back = "back",
}
