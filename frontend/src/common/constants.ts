import { Cardstock, CardType, Faces } from "@/common/types";

export const ProjectName = "MPC Autofill";
export const MakePlayingCards = "MakePlayingCards.com";
export const MakePlayingCardsURL = "https://www.makeplayingcards.com";

export const Card: CardType = "CARD";
export const Cardback: CardType = "CARDBACK";
export const Token: CardType = "TOKEN";

export const SelectedImageSeparator = "@";
export const CardTypeSeparator = ":";
export const FaceSeparator = "//";

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

export const ToggleButtonHeight = 38; // pixels
export const NavbarHeight = 50; // pixels - aligns with the natural height of the navbar
export const RibbonHeight = 54; // pixels
export const NavbarLogoHeight = 40; // pixels
export const ContentMaxWidth = 1200; // pixels - aligns with bootstrap's large breakpoint

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
  SearchResults = "searchResults",
  SampleCards = "sampleCards",
}

export const S27: Cardstock = "(S27) Smooth";
export const S30: Cardstock = "(S30) Standard Smooth";
export const S33: Cardstock = "(S33) Superior Smooth";
export const M31: Cardstock = "(M31) Linen";
export const P10: Cardstock = "(P10) Plastic";
export const Cardstocks: Array<Cardstock> = [S27, S30, S33, M31, P10];

export const CardstockFoilCompatibility: { [cardstock in Cardstock]: boolean } =
  {
    [S27]: true,
    [S30]: true,
    [S33]: true,
    [M31]: true,
    [P10]: false,
  };

export const GoogleDriveImageAPIURL =
  "https://script.google.com/macros/s/AKfycbw8laScKBfxda2Wb0g63gkYDBdy8NWNxINoC4xDOwnCQ3JMFdruam1MdmNmN4wI5k4/exec";

export const SearchResultsEndpointPageSize = 300;
export const CardEndpointPageSize = 1000;

export enum CSVHeaders {
  quantity = "Quantity",
  frontQuery = "Front",
  frontSelectedImage = "Front ID",
  backQuery = "Back",
  backSelectedImage = "Back ID",
}

export const ExploreDebounceMS = 700;
export const ExplorePageSize = 60;
