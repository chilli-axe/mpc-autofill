import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { GoogleDriveImageAPIURL, QueryTags } from "@/common/constants";
import { getCSRFHeader } from "@/common/cookies";
import { formatURL, processQuery } from "@/common/processing";
import {
  Card,
  CardbacksResponse,
  CardsRequest,
  CardsResponse,
  ContributionsResponse,
  DFCPairsResponse,
  EditorSearchRequest,
  EditorSearchResponse,
  ExploreSearchRequest,
  ExploreSearchResponse,
  ImportSite,
  ImportSiteDecklistRequest,
  ImportSiteDecklistResponse,
  ImportSitesResponse,
  Info,
  InfoResponse,
  Language,
  LanguagesResponse,
  NewCardsFirstPage,
  NewCardsFirstPagesResponse,
  NewCardsPageResponse,
  Patreon,
  PatreonResponse,
  SampleCardsResponse,
  SourcesResponse,
  Tag,
  TagsResponse,
} from "@/common/schema_types";
import {
  CardDocuments,
  DFCPairs,
  SearchQuery,
  SearchResults,
  SearchSettings,
  SourceDocuments,
} from "@/common/types";
import { useBackendConfigured } from "@/store/slices/backendSlice";
import { RootState } from "@/store/store";

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

export const api = createApi({
  reducerPath: "api",
  baseQuery: dynamicBaseQuery,
  tagTypes: [
    QueryTags.BackendSpecific,
    QueryTags.SearchResults,
    QueryTags.SampleCards,
  ],
  endpoints: (builder) => ({
    getImportSites: builder.query<Array<ImportSite>, void>({
      query: () => ({ url: `2/importSites/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: ImportSitesResponse, meta, arg) =>
        response.importSites,
    }),
    queryImportSite: builder.query<string, string>({
      query: (url) => ({
        url: `2/importSiteDecklist/`,
        method: "POST",
        body: JSON.stringify({ url } as ImportSiteDecklistRequest),
      }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: ImportSiteDecklistResponse, meta, arg) =>
        response.cards,
    }),
    getDFCPairs: builder.query<DFCPairs, void>({
      query: () => ({ url: `2/DFCPairs/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: DFCPairsResponse, meta, arg) => {
        // sanitise the front and back names before storing
        return Object.fromEntries(
          Object.keys(response.dfcPairs).map((front) => [
            processQuery(front),
            processQuery(response.dfcPairs[front]),
          ])
        );
      },
    }),
    getLanguages: builder.query<Array<Language>, void>({
      query: () => ({ url: `2/languages/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: LanguagesResponse, meta, arg) =>
        response.languages,
    }),
    getTags: builder.query<Array<Tag>, void>({
      query: () => ({ url: `2/tags/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: TagsResponse, meta, arg) => response.tags,
    }),
    getSampleCards: builder.query<{ [cardType: string]: Array<Card> }, void>({
      query: () => ({ url: `2/sampleCards/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific, QueryTags.SampleCards],
      transformResponse: (response: SampleCardsResponse, meta, arg) =>
        response.cards,
    }),
    getContributions: builder.query<ContributionsResponse, void>({
      query: () => ({ url: `2/contributions/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
    }),
    getBackendInfo: builder.query<Info, void>({
      query: () => ({ url: `2/info/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: InfoResponse, meta, arg) => response.info,
    }),
    getPatreon: builder.query<Patreon, void>({
      query: () => ({ url: `2/patreon/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: PatreonResponse, meta, arg) =>
        response.patreon,
    }),
    getGoogleDriveImage: builder.query<string, string>({
      query: (identifier: string) => ({
        url: GoogleDriveImageAPIURL,
        method: "GET",
        params: { id: identifier },
        responseHandler: "text",
      }),
    }),
    getNewCardsFirstPage: builder.query<
      { [sourceKey: string]: NewCardsFirstPage },
      void
    >({
      query: () => ({ url: `2/newCardsFirstPages/`, method: "GET" }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: NewCardsFirstPagesResponse, meta, arg) =>
        response.results,
    }),
    getNewCardsPage: builder.query<Array<Card>, [string, number]>({
      query: ([sourceKey, page]: [string, number]) => ({
        url: `2/newCardsPage/`,
        method: "GET",
        params: { source: sourceKey, page },
      }),
      providesTags: [QueryTags.BackendSpecific],
      transformResponse: (response: NewCardsPageResponse, meta, arg) =>
        response.cards,
      // the below code merges each source's pages of results together
      // check out the docs here https://redux-toolkit.js.org/rtk-query/api/createApi#merge
      serializeQueryArgs: ({ queryArgs, endpointDefinition, endpointName }) => {
        return `${endpointName} (${queryArgs[0]})`; // don't include page number in the serialised args
      },
      merge: (currentCache, newItems) => {
        currentCache.push(...newItems);
      },
      forceRefetch({ currentArg, previousArg }) {
        return (
          currentArg == null ||
          previousArg == null ||
          currentArg[0] !== previousArg[0] ||
          currentArg[1] !== previousArg[1]
        );
      },
    }),
    postExploreSearch: builder.query<
      ExploreSearchResponse,
      ExploreSearchRequest
    >({
      query: (exploreSearch) => ({
        url: `2/exploreSearch/`,
        method: "POST",
        body: JSON.stringify(exploreSearch),
      }),
      providesTags: [QueryTags.BackendSpecific],
      keepUnusedDataFor: 0.0, // never cache results
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
  useGetLanguagesQuery: useRawGetLanguagesQuery,
  useGetTagsQuery: useRawGetTagsQuery,
  useGetSampleCardsQuery: useRawGetSampleCardsQuery,
  useGetContributionsQuery: useRawGetContributionsQuery,
  useGetBackendInfoQuery: useRawGetBackendInfoQuery,
  useGetPatreonQuery: useRawGetPatreonQuery,
  useGetNewCardsFirstPageQuery: useRawGetNewCardsFirstPageQuery,
  useGetNewCardsPageQuery: useRawGetNewCardsPageQuery,
  usePostExploreSearchQuery: useRawPostExploreSearchQuery,
} = api;

export function useGetImportSitesQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetImportSitesQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetDFCPairsQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetDFCPairsQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetLanguagesQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetLanguagesQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetTagsQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetTagsQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetSampleCardsQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetSampleCardsQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetContributionsQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetContributionsQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetBackendInfoQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetBackendInfoQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetPatreonQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetPatreonQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetNewCardsFirstPageQuery() {
  const backendConfigured = useBackendConfigured();
  return useRawGetNewCardsFirstPageQuery(undefined, {
    skip: !backendConfigured,
  });
}

export function useGetNewCardsPageQuery([sourceKey, page]: [string, number]) {
  const backendConfigured = useBackendConfigured();
  return useRawGetNewCardsPageQuery([sourceKey, page], {
    skip: !backendConfigured || page <= 1,
  });
}

export function usePostExploreSearchQuery(
  exploreSearchRequest: ExploreSearchRequest
) {
  const backendConfigured = useBackendConfigured();
  return useRawPostExploreSearchQuery(exploreSearchRequest, {
    skip: !backendConfigured,
  });
}

//# endregion

export async function APIGetCards(
  backendURL: string,
  identifiersToSearch: Array<string>
): Promise<CardDocuments> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/cards/"), {
    method: "POST",
    body: JSON.stringify({
      cardIdentifiers: identifiersToSearch,
    } as CardsRequest),
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  return rawResponse.json().then((content) => {
    if (rawResponse.status === 200 && content.results != null) {
      return (content as CardsResponse).results;
    }
    throw { name: content.name, message: content.message };
  });
}

export async function APIGetCardbacks(
  backendURL: string,
  searchSettings: SearchSettings
): Promise<Array<string>> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/cardbacks/"), {
    method: "POST",
    body: JSON.stringify({
      searchSettings,
    }),
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  return rawResponse.json().then((content) => {
    if (rawResponse.status === 200 && content.cardbacks != null) {
      return (content as CardbacksResponse).cardbacks;
    }
    throw { name: content.name, message: content.message };
  });
}

export async function APIEditorSearch(
  backendURL: string,
  searchSettings: SearchSettings,
  queriesToSearch: Array<SearchQuery>
): Promise<SearchResults> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/editorSearch/"), {
    method: "POST",
    body: JSON.stringify({
      searchSettings,
      queries: queriesToSearch,
    } as EditorSearchRequest),
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  return rawResponse.json().then((content) => {
    if (rawResponse.status === 200 && content.results != null) {
      return content.results; // TODO: (content as EditorSearchResponse).results;
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
    if (rawResponse.status === 200 && content.results != null) {
      return (content as SourcesResponse).results;
    }
    throw { name: content.name, message: content.message };
  });
}
