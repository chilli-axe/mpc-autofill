import { CardType, Faces } from "./types";

export const Card: CardType = "CARD";
export const Cardback: CardType = "CARDBACK";
export const Token: CardType = "TOKEN";

export const CardTypePrefixes = {
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
