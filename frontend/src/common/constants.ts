export const ProjectName = "MPC Autofill";

import { CardType, Faces } from "@/common/types";

export const Card: CardType = "CARD";
export const Cardback: CardType = "CARDBACK";
export const Token: CardType = "TOKEN";

export const CardTypeSeparator = ":";

export const CardTypePrefixes: { [prefix: string]: CardType } = {
  "": Card,
  b: Cardback,
  t: Token,
};

export const ReversedCardTypePrefixes = Object.fromEntries(
  Object.keys(CardTypePrefixes).map((prefix: string) => [
    CardTypePrefixes[prefix],
    prefix.length > 0 ? prefix + CardTypeSeparator : prefix,
  ])
);

export const Front: Faces = "front";
export const Back: Faces = "back";
export const FaceSeparator = "|";

export const ToggleButtonHeight = 38; // pixels

export const MinimumDPI = 0;
export const MaximumDPI = 1500;
export const DPIStep = 50;

export const MaximumSize = 30; // megabytes
export const SizeStep = 1;

export const CSRFKey = "csrftoken";
export const SearchSettingsKey = "searchSettings";
export const GoogleAnalyticsConsentKey = "googleAnalyticsConsent";
export const BackendURLKey = "backendURL";

export const Brackets: Array<number> = [
  18, 36, 55, 72, 90, 108, 126, 144, 162, 180, 198, 216, 234, 396, 504, 612,
];

export const ProjectMaxSize: number = Brackets[Brackets.length - 1];

export enum QueryTags {
  BackendSpecific = "backendSpecific",
}
