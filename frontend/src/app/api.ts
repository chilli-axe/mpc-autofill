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
} from "@/common/types";
import { getCSRFHeader } from "@/common/cookies";
import { formatURL } from "@/common/processing";

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

export async function APIGetImportSites(backendURL: string) {
  const rawResponse = await fetch(formatURL(backendURL, "/2/importSites"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.import_sites;
}

export async function APIQueryImportSite(
  backendURL: string,
  url: string
): Promise<string> {
  const rawResponse = await fetch(
    formatURL(backendURL, "/2/importSiteDecklist/"),
    {
      method: "POST",
      body: JSON.stringify({ url }),
      credentials: "same-origin",
      headers: getCSRFHeader(),
    }
  );
  const content = await rawResponse.json();
  return content.cards;
}

export async function APIGetDFCPairs(backendURL: string): Promise<DFCPairs> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/DFCPairs/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.dfc_pairs;
}

export async function APIGetPlaceholderText(backendURL: string): Promise<{
  [cardType: string]: Array<[number, string]>;
}> {
  const rawResponse = await fetch(
    formatURL(backendURL, "/2/placeholderText/"),
    {
      method: "GET",
      credentials: "same-origin",
      headers: getCSRFHeader(),
    }
  );
  const content = await rawResponse.json();
  return content.cards;
}

export async function APIGetBackendInfo(
  backendURL: string
): Promise<BackendInfo> {
  const rawResponse = await fetch(formatURL(backendURL, "/2/info/"), {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.info;
}
