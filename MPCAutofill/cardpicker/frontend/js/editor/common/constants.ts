import { CardType, Faces } from "./types";

export const Card: CardType = "CARD";
export const Cardback: CardType = "CARDBACK";
export const Token: CardType = "TOKEN";

export const CardTypeSeparator = ":";

export const CardTypePrefixes: { [prefix: string]: CardType } = {
  "": Card,
  b: Cardback,
  t: Token,
};

export const Front: Faces = "front";
export const Back: Faces = "back";
export const FaceSeparator = "|";

export const ToggleButtonHeight = 38; // pixels

export const MinimumDPI = 0;
export const MaximumDPI = 1500;
export const DPIStep = 50;

export const MaximumSize = 30; // megabytes
export const SizeStep = 1;

export const CSRFToken = "csrftoken";

export const Brackets: Array<number> = [
  18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612,
];
