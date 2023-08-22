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

const createError = (name: string) => ({
  name,
  message: "A message that describes the error",
});

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

export const sourceDocumentsServerError = rest.get(
  buildRoute("2/sources/"),
  (req, res, ctx) => res(ctx.status(500), ctx.json(createError("2/sources")))
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

export const cardDocumentsServerError = rest.post(
  buildRoute("2/cards/"),
  (req, res, ctx) => res(ctx.status(500), ctx.json(createError("2/cards")))
);

//# endregion

//# region cardback

export const cardbacksNoResults = rest.post(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ cardbacks: [] }));
  }
);

export const cardbacksOneResult = rest.post(
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

export const cardbacksOneOtherResult = rest.post(
  buildRoute("2/cardbacks"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        cardbacks: [cardDocument5.identifier],
      })
    );
  }
);

export const cardbacksTwoResults = rest.post(
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

export const cardbacksTwoOtherResults = rest.post(
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

export const cardbacksServerError = rest.post(
  buildRoute("2/cardbacks/"),
  (req, res, ctx) => res(ctx.status(500), ctx.json(createError("2/cardbacks")))
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
            CARD: [cardDocument3.identifier],
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

export const searchResultsServerError = rest.post(
  buildRoute("2/searchResults/"),
  (req, res, ctx) =>
    res(ctx.status(500), ctx.json(createError("2/searchResults")))
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

export const dfcPairsServerError = rest.get(
  buildRoute("2/DFCPairs/"),
  (req, res, ctx) => res(ctx.status(500), ctx.json(createError("2/DFCPairs")))
);

//# endregion

//# region languages

export const languagesNoResults = rest.get(
  buildRoute("2/languages/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ languages: [] }));
  }
);

export const languagesTwoResults = rest.get(
  buildRoute("2/languages/"),
  (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        languages: [
          { name: "English", code: "EN" },
          { name: "French", code: "FR" },
        ],
      })
    );
  }
);

//# endregion

//# region tags

export const tagsNoResults = rest.get(
  buildRoute("2/tags/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ tags: [] }));
  }
);

export const tagsTwoResults = rest.get(
  buildRoute("2/tags/"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ tags: ["Tag 1", "Tag 2"] }));
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

export const sampleCardsServerError = rest.get(
  buildRoute("2/sampleCards/"),
  (req, res, ctx) =>
    res(ctx.status(500), ctx.json(createError("2/sampleCards")))
);

//# endregion

//# region import sites

export const importSitesNoResults = rest.get(
  buildRoute("2/importSites"),
  (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ import_sites: [] }));
  }
);

export const importSitesServerError = rest.get(
  buildRoute("2/importSites/"),
  (req, res, ctx) =>
    res(ctx.status(500), ctx.json(createError("2/importSites")))
);

//# endregion

//# region what's new

export const newCardsFirstPageWithTwoSources = rest.get(
  buildRoute("2/newCardsFirstPages"),
  (req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json({
        results: {
          [sourceDocument1.key]: {
            source: sourceDocument1,
            hits: 4,
            pages: 2,
            cards: [cardDocument1, cardDocument2],
          },
          [sourceDocument2.key]: {
            source: sourceDocument2,
            hits: 1,
            pages: 1,
            cards: [cardDocument5],
          },
        },
      })
    )
);

export const newCardsFirstPageNoResults = rest.get(
  buildRoute("2/newCardsFirstPages"),
  (req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json({
        results: {},
      })
    )
);

export const newCardsPageForSource1 = rest.get(
  buildRoute(`2/newCardsPage?source=${sourceDocument1.key}&page=2`),
  (req, res, ctx) =>
    res(ctx.status(200), ctx.json({ cards: [cardDocument3, cardDocument4] }))
);

export const newCardsFirstPageServerError = rest.get(
  buildRoute("2/newCardsFirstPages"),
  (req, res, ctx) =>
    res(ctx.status(500), ctx.json(createError("2/newCardsFirstPage")))
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

export const backendInfoServerError = rest.get(
  buildRoute("2/info/"),
  (req, res, ctx) => res(ctx.status(500), ctx.json(createError("2/info")))
);

//# endregion

//# region health

export const searchEngineHealthy = rest.get(
  buildRoute("2/searchEngineHealth/"),
  (req, res, ctx) => res(ctx.status(200), ctx.json({ online: true }))
);

//# endregion

//# region presets

export const defaultHandlers = [
  sourceDocumentsNoResults,
  cardDocumentsNoResults,
  cardbacksNoResults,
  searchResultsNoResults,
  dfcPairsNoResults,
  languagesTwoResults,
  tagsNoResults,
  importSitesNoResults,
  sampleCards,
  backendInfoNoPatreon,
  searchEngineHealthy,
];

//# endregion
