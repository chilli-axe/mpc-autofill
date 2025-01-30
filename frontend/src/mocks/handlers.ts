import { http, HttpResponse } from "msw";

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

/**
 * Not including the correct leading and trailing slashes can break things.
 * This little helper function ensures the given relative API route is associated
 * with the local backend URL correctly.
 * TODO: not sure how true the above statement is as of MSW 2.7
 */
function buildRoute(route: string) {
  const re = /^\/?(.*?)\/?$/g;
  return `${localBackend.url}/${(re.exec(route) ?? ["", ""])[1]}`;
}

//# region source

export const sourceDocumentsNoResults = http.get(buildRoute("2/sources/"), () =>
  HttpResponse.json({ results: {} }, { status: 200 })
);

export const sourceDocumentsOneResult = http.get(buildRoute("2/sources/"), () =>
  HttpResponse.json(
    {
      results: {
        [sourceDocument1.pk]: sourceDocument1,
      },
    },
    { status: 200 }
  )
);

export const sourceDocumentsThreeResults = http.get(
  buildRoute("2/sources/"),
  () =>
    HttpResponse.json(
      {
        results: {
          [sourceDocument1.pk]: sourceDocument1,
          [sourceDocument2.pk]: sourceDocument2,
          [sourceDocument3.pk]: sourceDocument3,
        },
      },
      { status: 200 }
    )
);

export const sourceDocumentsServerError = http.get(
  buildRoute("2/sources/"),
  () => HttpResponse.json(createError("2/sources"), { status: 500 })
);

//# endregion

//# region card

export const cardDocumentsNoResults = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json({ results: {} }, { status: 200 })
);

export const cardDocumentsOneResult = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json(
    {
      results: {
        [cardDocument1.identifier]: cardDocument1,
      },
    },
    { status: 200 }
  )
);

export const cardDocumentsThreeResults = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json(
    {
      results: {
        [cardDocument1.identifier]: cardDocument1,
        [cardDocument2.identifier]: cardDocument2,
        [cardDocument3.identifier]: cardDocument3,
      },
    },
    { status: 200 }
  )
);

export const cardDocumentsFourResults = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json(
    {
      results: {
        [cardDocument1.identifier]: cardDocument1,
        [cardDocument2.identifier]: cardDocument2,
        [cardDocument3.identifier]: cardDocument3,
        [cardDocument4.identifier]: cardDocument4,
      },
    },
    { status: 200 }
  )
);

export const cardDocumentsSixResults = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json(
    {
      results: {
        [cardDocument1.identifier]: cardDocument1,
        [cardDocument2.identifier]: cardDocument2,
        [cardDocument3.identifier]: cardDocument3,
        [cardDocument4.identifier]: cardDocument4,
        [cardDocument5.identifier]: cardDocument5,
        [cardDocument6.identifier]: cardDocument6,
      },
    },
    { status: 200 }
  )
);

export const cardDocumentsServerError = http.post(buildRoute("2/cards/"), () =>
  HttpResponse.json(createError("2/cards"), { status: 500 })
);

//# endregion

//# region cardback

export const cardbacksNoResults = http.post(buildRoute("2/cardbacks"), () =>
  HttpResponse.json({ cardbacks: [] }, { status: 200 })
);

export const cardbacksOneResult = http.post(buildRoute("2/cardbacks"), () =>
  HttpResponse.json(
    {
      cardbacks: [cardDocument1.identifier],
    },
    { status: 200 }
  )
);

export const cardbacksOneOtherResult = http.post(
  buildRoute("2/cardbacks"),
  () =>
    HttpResponse.json(
      {
        cardbacks: [cardDocument5.identifier],
      },
      { status: 200 }
    )
);

export const cardbacksTwoResults = http.post(buildRoute("2/cardbacks"), () =>
  HttpResponse.json(
    {
      cardbacks: [cardDocument1.identifier, cardDocument2.identifier],
    },
    { status: 200 }
  )
);

export const cardbacksTwoOtherResults = http.post(
  buildRoute("2/cardbacks"),
  () =>
    HttpResponse.json(
      {
        cardbacks: [cardDocument2.identifier, cardDocument3.identifier],
      },
      { status: 200 }
    )
);

export const cardbacksServerError = http.post(buildRoute("2/cardbacks/"), () =>
  HttpResponse.json(createError("2/cardbacks"), { status: 500 })
);

//# endregion

//# region search results

export const searchResultsNoResults = http.post(
  buildRoute("2/editorSearch/"),
  () => HttpResponse.json({ results: {} }, { status: 200 })
);

export const searchResultsOneResult = http.post(
  buildRoute("2/editorSearch/"),
  () =>
    HttpResponse.json(
      {
        results: {
          "my search query": {
            CARD: [cardDocument1.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
        },
      },
      { status: 200 }
    )
);

export const searchResultsThreeResults = http.post(
  buildRoute("2/editorSearch/"),
  () =>
    HttpResponse.json(
      {
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
      },
      { status: 200 }
    )
);

export const searchResultsFourResults = http.post(
  buildRoute("2/editorSearch/"),
  () =>
    HttpResponse.json(
      {
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
      },
      { status: 200 }
    )
);

export const searchResultsSixResults = http.post(
  buildRoute("2/editorSearch/"),
  () =>
    HttpResponse.json(
      {
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
      },
      { status: 200 }
    )
);

export const searchResultsForDFCMatchedCards1And4 = http.post(
  buildRoute("2/editorSearch/"),
  () =>
    HttpResponse.json(
      {
        results: {
          "my search query": {
            CARD: [cardDocument1.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "card 3": {
            CARD: [cardDocument3.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
          "card 4": {
            CARD: [cardDocument4.identifier],
            CARDBACK: [],
            TOKEN: [],
          },
        },
      },
      { status: 200 }
    )
);

export const searchResultsServerError = http.post(
  buildRoute("2/editorSearch/"),
  () => HttpResponse.json(createError("2/editorSearch"), { status: 200 })
);

//# endregion

//# region dfc pairs

export const dfcPairsNoResults = http.get(buildRoute("2/DFCPairs/"), () =>
  HttpResponse.json({ dfc_pairs: {} }, { status: 200 })
);

export const dfcPairsMatchingCards1And4 = http.get(
  buildRoute("2/DFCPairs/"),
  () =>
    HttpResponse.json(
      { dfc_pairs: { ["my search query"]: cardDocument4.name } },
      { status: 200 }
    )
);

export const dfcPairsServerError = http.get(buildRoute("2/DFCPairs/"), () =>
  HttpResponse.json(createError("2/DFCPairs"), { status: 500 })
);

//# endregion

//# region languages

export const languagesNoResults = http.get(buildRoute("2/languages/"), () =>
  HttpResponse.json({ languages: [] }, { status: 200 })
);

export const languagesTwoResults = http.get(buildRoute("2/languages/"), () =>
  HttpResponse.json(
    {
      languages: [
        { name: "English", code: "EN" },
        { name: "French", code: "FR" },
      ],
    },
    { status: 200 }
  )
);

//# endregion

//# region tags

export const tagsNoResults = http.get(buildRoute("2/tags/"), () =>
  HttpResponse.json({ tags: [] }, { status: 200 })
);

export const tagsTwoResults = http.get(buildRoute("2/tags/"), () =>
  HttpResponse.json({ tags: ["Tag 1", "Tag 2"] }, { status: 200 })
);

//# endregion

//# region sample cards

export const sampleCards = http.get(buildRoute("2/sampleCards"), () =>
  HttpResponse.json(
    {
      cards: {
        [Card]: [cardDocument1, cardDocument2, cardDocument3, cardDocument4],
        [Cardback]: [cardDocument5],
        [Token]: [cardDocument6],
      },
    },
    { status: 200 }
  )
);

export const sampleCardsServerError = http.get(
  buildRoute("2/sampleCards/"),
  () => HttpResponse.json(createError("2/sampleCards"), { status: 500 })
);

//# endregion

//# region import sites

export const importSitesNoResults = http.get(buildRoute("2/importSites"), () =>
  HttpResponse.json({ import_sites: [] }, { status: 200 })
);

export const importSitesOneResult = http.get(buildRoute("2/importSites"), () =>
  HttpResponse.json(
    { import_sites: [{ name: "test", url: "test.com" }] },
    { status: 200 }
  )
);

export const importSitesServerError = http.get(
  buildRoute("2/importSites/"),
  () => HttpResponse.json(createError("2/importSites"), { status: 500 })
);

//# endregion

//# region what's new

export const newCardsFirstPageWithTwoSources = http.get(
  buildRoute("2/newCardsFirstPages"),
  () =>
    HttpResponse.json(
      {
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
      },
      { status: 200 }
    )
);

export const newCardsFirstPageNoResults = http.get(
  buildRoute("2/newCardsFirstPages"),
  () =>
    HttpResponse.json(
      {
        results: {},
      },
      { status: 200 }
    )
);

export const newCardsPageForSource1 = http.get(
  buildRoute(`2/newCardsPage?source=${sourceDocument1.key}&page=2`),
  () =>
    HttpResponse.json(
      { cards: [cardDocument3, cardDocument4] },
      { status: 200 }
    )
);

export const newCardsFirstPageServerError = http.get(
  buildRoute("2/newCardsFirstPages"),
  () => HttpResponse.json(createError("2/newCardsFirstPage"), { status: 500 })
);

//# endregion

//# region backend info

export const backendInfoNoPatreon = http.get(buildRoute("2/info"), () =>
  HttpResponse.json(
    {
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
    },
    { status: 200 }
  )
);

export const backendInfoServerError = http.get(buildRoute("2/info/"), () =>
  HttpResponse.json(createError("2/info"), { status: 500 })
);

//# endregion

//# region health

export const searchEngineHealthy = http.get(
  buildRoute("2/searchEngineHealth/"),
  () => HttpResponse.json({ online: true }, { status: 200 })
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
  importSitesOneResult,
  sampleCards,
  backendInfoNoPatreon,
  searchEngineHealthy,
];

//# endregion
