// TODO: set up the below API calls to use best practices with handling all cases `fetch` can return
// TODO: read this http://florimond.dev/en/posts/2018/08/restful-api-design-13-best-practices-to-make-your-users-happy/
// Need to use the React-specific entry point to allow generating React hooks
import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { RootState } from "@/app/store";
import { GoogleDriveImageAPIURL, QueryTags } from "@/common/constants";
import { getCSRFHeader } from "@/common/cookies";
import { processQuery } from "@/common/processing";
import { formatURL } from "@/common/processing";
import { useAppSelector } from "@/common/types";
import {
  BackendInfo,
  CardDocument,
  CardDocuments,
  Contributions,
  DFCPairs,
  ImportSite,
  SearchQuery,
  SearchResults,
  SearchSettings,
  SourceDocuments,
} from "@/common/types";
import { selectBackendURL } from "@/features/backend/backendSlice";

// dynamic base URL implementation retrieved from https://stackoverflow.com/a/69570628/13021511
const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, WebApi, extraOptions) => {
  const baseUrl = (WebApi.getState() as RootState).backend.url;
  const rawBaseQuery = fetchBaseQuery({ baseUrl: baseUrl ?? undefined });
  return rawBaseQuery(args, WebApi, extraOptions);
};

// TODO: consider splitting the API across multiple files for readability
export const api = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  tagTypes: [QueryTags.BackendSpecific, QueryTags.SearchResults],
  endpoints: (builder) => ({
    getImportSites: builder.query<Array<ImportSite>, void>({
      query: () => ({ url: `2/importSites/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
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
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: { cards: string }, meta, arg) =>
        response.cards,
    }),
    getDFCPairs: builder.query<DFCPairs, void>({
      query: () => ({ url: `2/DFCPairs/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
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
    getSampleCards: builder.query<
      { [cardType: string]: Array<CardDocument> },
      void
    >({
      query: () => ({ url: `2/sampleCards/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (
        response: { cards: { [cardType: string]: Array<CardDocument> } },
        meta,
        arg
      ) => response.cards,
    }),
    getContributions: builder.query<Contributions, void>({
      query: () => ({ url: `2/contributions/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
    }),
    getBackendInfo: builder.query<BackendInfo, void>({
      query: () => ({ url: `2/info/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: { info: BackendInfo }, meta, arg) =>
        response.info,
    }),
    getGoogleDriveImage: builder.query<string, string>({
      query: (identifier: string) => ({
        url: GoogleDriveImageAPIURL,
        method: "GET",
        params: { id: identifier },
        responseHandler: "text",
      }),
      keepUnusedDataFor: 1,
    }),
  }),
});

//# region hooks

// Export hooks for usage in function components.
// We add an extra layer on top of RTK Query's auto-generated hooks
// to ensure they only fire when a backend is connected.
const {
  useGetImportSitesQuery: useRawGetImportSitesQuery,
  useQueryImportSiteQuery: useRawQueryImportSiteQuery,
  useGetDFCPairsQuery: useRawGetDFCPairsQuery,
  useGetSampleCardsQuery: useRawGetSampleCardsQuery,
  useGetContributionsQuery: useRawGetContributionsQuery,
  useGetBackendInfoQuery: useRawGetBackendInfoQuery,
} = api;

export function useGetImportSitesQuery() {
  const backendURL = useAppSelector(selectBackendURL);
  return useRawGetImportSitesQuery(undefined, {
    skip: backendURL == null,
  });
}

export function useGetDFCPairsQuery() {
  const backendURL = useAppSelector(selectBackendURL);
  return useRawGetDFCPairsQuery(undefined, {
    skip: backendURL == null,
  });
}

export function useGetSampleCardsQuery() {
  const backendURL = useAppSelector(selectBackendURL);
  return useRawGetSampleCardsQuery(undefined, {
    skip: backendURL == null,
  });
}

export function useGetContributionsQuery() {
  const backendURL = useAppSelector(selectBackendURL);
  return useRawGetContributionsQuery(undefined, {
    skip: backendURL == null,
  });
}

export function useGetBackendInfoQuery() {
  const backendURL = useAppSelector(selectBackendURL);
  return useRawGetBackendInfoQuery(undefined, {
    skip: backendURL == null,
  });
}

//# endregion

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
  return rawResponse.json().then((content) => {
    if (content.results != null) {
      return content.results;
    }
    throw { name: content.name, message: content.message };
  });
}

export async function APIGetCardbacks(
  backendURL: string
): Promise<Array<string>> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/cardbacks/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  return rawResponse.json().then((content) => {
    if (content.cardbacks != null) {
      return content.cardbacks;
    }
    throw { name: content.name, message: content.message };
  });
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
  return rawResponse.json().then((content) => {
    if (content.results != null) {
      return content.results;
    }
    throw { name: content.name, message: content.message };
  });
}

export async function APIGetSources(
  backendURL: string
): Promise<SourceDocuments> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/sources/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  return rawResponse.json().then((content) => {
    if (content.results != null) {
      return content.results;
    }
    throw { name: content.name, message: content.message };
  });
}
