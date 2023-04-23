import { rest } from "msw";
import {
  localBackend,
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
  sourceDocument1,
  sourceDocument2,
  sourceDocument3,
} from "@/common/test-constants";
import { Card, Cardback, Token } from "@/common/constants";

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

export const searchResultsSixResults = rest.post(
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
