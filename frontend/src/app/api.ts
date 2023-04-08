// TODO: set up the below API calls to use best practices with handling all cases `fetch` can return
// TODO: read this http://florimond.dev/en/posts/2018/08/restful-api-design-13-best-practices-to-make-your-users-happy/
import {
  SearchSettings,
  CardDocuments,
  SearchResults,
  SourceDocuments,
  SearchQuery,
  DFCPairs,
  BackendInfo,
  ImportSite,
} from "@/common/types";
import { RootState } from "@/app/store";

// Need to use the React-specific entry point to allow generating React hooks
import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

// dynamic base URL implementation retrieved from https://stackoverflow.com/a/69570628/13021511
const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, WebApi, extraOptions) => {
  const baseUrl = (WebApi.getState() as RootState).backend.url;
  const rawBaseQuery = fetchBaseQuery({ baseUrl });
  return rawBaseQuery(args, WebApi, extraOptions);
};

// TODO: consider splitting the API across multiple files for readability
export const apiSlice = createApi({
  reducerPath: "apiSlice",
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    getCards: builder.query<CardDocuments, Set<string>>({
      query: (identifiersToSearch) => ({
        url: `2/cards/`,
        method: "POST",
        body: { card_identifiers: JSON.stringify(identifiersToSearch) },
      }),
      transformResponse: (response: { results: CardDocuments }, meta, arg) =>
        response.results,
    }),
    getCardbacks: builder.query<Array<string>, void>({
      query: () => ({ url: `2/cardbacks/`, method: "GET" }),
      transformResponse: (response: { cardbacks: Array<string> }, meta, arg) =>
        response.cardbacks,
    }),
    search: builder.query<
      SearchResults,
      { searchSettings: SearchSettings; queries: Array<SearchQuery> }
    >({
      query: (input) => ({
        url: `2/searchResults/`,
        method: "POST",
        body: JSON.stringify({
          searchSettings: input.searchSettings,
          queries: Array.from(input.queries),
        }),
      }),
      transformResponse: (response: { results: SearchResults }, meta, arg) =>
        response.results,
    }),
    getSources: builder.query<SourceDocuments, void>({
      query: () => ({ url: `2/sources/`, method: "GET" }),
      transformResponse: (response: { results: SourceDocuments }, meta, arg) =>
        response.results,
    }),
    getImportSites: builder.query<Array<ImportSite>, void>({
      query: () => ({ url: `2/importSites/`, method: "GET" }),
      transformResponse: (
        response: { import_sites: Array<ImportSite> },
        meta,
        arg
      ) => response.import_sites,
    }),
    queryImportSite: builder.query<string, string>({
      query: (url) => ({
        url: `2/importSiteDecklist/`,
        method: "POST",
        body: JSON.stringify({ url }),
      }),
      transformResponse: (response: { cards: string }, meta, arg) =>
        response.cards,
    }),
    getDFCPairs: builder.query<DFCPairs, void>({
      query: () => ({ url: `2/DFCPairs/`, method: "GET" }),
      transformResponse: (response: { dfc_pairs: DFCPairs }, meta, arg) => {
        // sanitise the front and back names before storing
        return Object.fromEntries(
          Object.keys(response.dfc_pairs).map((front) => [
            processQuery(front),
            processQuery(response.dfc_pairs[front]),
          ])
        );
      },
    }),
    getPlaceholderText: builder.query<
      { [cardType: string]: Array<[number, string]> },
      void
    >({
      query: () => ({ url: `2/placeholderText/`, method: "GET" }),
      transformResponse: (
        response: { cards: { [cardType: string]: Array<[number, string]> } },
        meta,
        arg
      ) => response.cards,
    }),
    getBackendInfo: builder.query<BackendInfo, void>({
      query: () => ({ url: `2/info/`, method: "GET" }),
      transformResponse: (response: { info: BackendInfo }, meta, arg) =>
        response.info,
    }),
  }),
});

// Export hooks for usage in function components, which are
// auto-generated based on the defined endpoints
export const {
  useGetCardsQuery,
  useGetCardbacksQuery,
  useSearchQuery,
  useGetSourcesQuery,
  useGetImportSitesQuery,
  useQueryImportSiteQuery,
  useGetDFCPairsQuery,
  useGetPlaceholderTextQuery,
  useGetBackendInfoQuery,
} = apiSlice;

import { getCSRFHeader } from "@/common/cookies";
import { formatURL, processQuery } from "@/common/processing";

export async function APIGetCards(
  backendURL: string,
  identifiersToSearch: Set<string>
): Promise<CardDocuments> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/cards/"), {
    method: "POST",
    body: JSON.stringify({
      card_identifiers: Array.from(identifiersToSearch),
    }),
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetCardbacks(
  backendURL: string
): Promise<Array<string>> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/cardbacks/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.cardbacks;
}

export async function APISearch(
  backendURL: string,
  searchSettings: SearchSettings,
  queriesToSearch: Array<SearchQuery>
): Promise<SearchResults> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/searchResults/"), {
    method: "POST",
    body: JSON.stringify({
      searchSettings,
      queries: Array.from(queriesToSearch),
    }),
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetSources(
  backendURL: string
): Promise<SourceDocuments> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/sources/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.results;
}
