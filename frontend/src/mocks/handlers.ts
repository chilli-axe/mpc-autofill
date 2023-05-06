import { rest } from "msw";

import { Card, Cardback, Token } from "@/common/constants";
import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
  localBackend,
  sourceDocument1,
  sourceDocument2,
  sourceDocument3,
} from "@/common/test-constants";

function buildRoute(route: string) {
  /**
   * Not including the correct leading and trailing slashes can break things.
   * This little helper function ensures the given relative API route is associated
   * with the local backend URL correctly.
   */

  const re = /^\/?(.*?)\/?$/g;
  return `${localBackend.url}/${(re.exec(route) ?? ["", ""])[1]}/`;
}

//# region source

export const sourceDocumentsNoResults = rest.get(
  buildRoute("2/sources/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ results: {} }));
  }
);

export const sourceDocumentsOneResult = rest.get(
  buildRoute("2/sources/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [sourceDocument1.pk]: sourceDocument1,
        },
      })
    );
  }
);

export const sourceDocumentsThreeResults = rest.get(
  buildRoute("2/sources/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [sourceDocument1.pk]: sourceDocument1,
          [sourceDocument2.pk]: sourceDocument2,
          [sourceDocument3.pk]: sourceDocument3,
        },
      })
    );
  }
);

//# endregion

//# region card

export const cardDocumentsNoResults = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ results: {} }));
  }
);

export const cardDocumentsOneResult = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [cardDocument1.identifier]: cardDocument1,
        },
      })
    );
  }
);

export const cardDocumentsThreeResults = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [cardDocument1.identifier]: cardDocument1,
          [cardDocument2.identifier]: cardDocument2,
          [cardDocument3.identifier]: cardDocument3,
        },
      })
    );
  }
);

export const cardDocumentsFourResults = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [cardDocument1.identifier]: cardDocument1,
          [cardDocument2.identifier]: cardDocument2,
          [cardDocument3.identifier]: cardDocument3,
          [cardDocument4.identifier]: cardDocument4,
        },
      })
    );
  }
);

export const cardDocumentsSixResults = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          [cardDocument1.identifier]: cardDocument1,
          [cardDocument2.identifier]: cardDocument2,
          [cardDocument3.identifier]: cardDocument3,
          [cardDocument4.identifier]: cardDocument4,
          [cardDocument5.identifier]: cardDocument5,
          [cardDocument6.identifier]: cardDocument6,
        },
      })
    );
  }
);

//# endregion

//# region cardback

export const cardbacksNoResults = rest.get(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ cardbacks: [] }));
  }
);

export const cardbacksOneResult = rest.get(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cardbacks: [cardDocument1.identifier],
      })
    );
  }
);

export const cardbacksTwoResults = rest.get(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cardbacks: [cardDocument1.identifier, cardDocument2.identifier],
      })
    );
  }
);

export const cardbacksTwoOtherResults = rest.get(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cardbacks: [cardDocument2.identifier, cardDocument3.identifier],
      })
    );
  }
);

//# endregion

//# region search results

export const searchResultsNoResults = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ results: {} }));
  }
);

export const searchResultsOneResult = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          "my search query": {
            CARD: [cardDocument1.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
        },
      })
    );
  }
);

export const searchResultsThreeResults = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          "my search query": {
            CARD: [
              cardDocument1.identifier,
              cardDocument2.identifier,
              cardDocument3.identifier,
            ],
            CARDBACK: [],
            TOKEN: [],
          },
        },
      })
    );
  }
);

export const searchResultsFourResults = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          "my search query": {
            CARD: [
              cardDocument1.identifier,
              cardDocument2.identifier,
              cardDocument3.identifier,
              cardDocument4.identifier,
            ],
            CARDBACK: [cardDocument5.identifier],
            TOKEN: [cardDocument6.identifier],
          },
        },
      })
    );
  }
);

export const searchResultsSixResults = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          "query 1": {
            CARD: [cardDocument1.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "query 2": {
            CARD: [cardDocument2.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "query 3": {
            CARD: [cardDocument4.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "query 4": {
            CARD: [cardDocument4.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "query 5": {
            CARD: [],
            CARDBACK: [cardDocument5.identifier],
            TOKEN: [],
          },
          "query 6": {
            CARD: [],
            CARDBACK: [],
            TOKEN: [cardDocument6.identifier],
          },
        },
      })
    );
  }
);

export const searchResultsForDFCMatchedCards1And4 = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: {
          "my search query": {
            CARD: [cardDocument1.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "card 4": {
            CARD: [cardDocument4.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
        },
      })
    );
  }
);

//# endregion

//# region dfc pairs

export const dfcPairsNoResults = rest.get(
  buildRoute("2/DFCPairs/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ dfc_pairs: {} }));
  }
);

export const dfcPairsMatchingCards1And4 = rest.get(
  buildRoute("2/DFCPairs/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ dfc_pairs: { ["my search query"]: cardDocument4.name } })
    );
  }
);

//# endregion

//# region sample cards

export const sampleCards = rest.get(
  buildRoute("2/sampleCards"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cards: {
          [Card]: [cardDocument1, cardDocument2, cardDocument3, cardDocument4],
          [Cardback]: [cardDocument5],
          [Token]: [cardDocument6],
        },
      })
    );
  }
);

//# endregion

//# region import sites

export const importSitesNoResults = rest.get(
  buildRoute("2/importSites"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ import_sites: [] }));
  }
);

//# endregion

//# region backend info

export const backendInfoNoPatreon = rest.get(
  buildRoute("2/info"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        info: {
          name: "Test Site",
          description: "Test runner site",
          email: "test@test.com",
          reddit: "reddit.com",
          discord: "discord.com",
          patreon: {
            url: "",
            members: null,
            tiers: null,
            campaign: null,
          },
        },
      })
    );
  }
);

//# endregion

//# region presets

export const defaultHandlers = [
  sourceDocumentsNoResults,
  cardDocumentsNoResults,
  cardbacksNoResults,
  searchResultsNoResults,
  dfcPairsNoResults,
  importSitesNoResults,
  sampleCards,
  backendInfoNoPatreon,
];

//# endregion
