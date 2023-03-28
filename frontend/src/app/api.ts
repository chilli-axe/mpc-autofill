// TODO: set up the below API calls to use best practices with handling all cases `fetch` can return
// TODO: read this http://florimond.dev/en/posts/2018/08/restful-api-design-13-best-practices-to-make-your-users-happy/
import {
  SearchSettings,
  CardDocuments,
  SearchResults,
  SourceDocuments,
  SearchQuery,
  DFCPairs,
} from "@/common/types";
import { getCSRFHeader } from "@/common/cookies";

// TODO: hardcoding this to 127.0.0.1:8000 is temporary for local dev.
// remove this when adding config for which domain to query.

export async function APIGetCards(
  identifiersToSearch: Set<string>
): Promise<CardDocuments> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/cards/", {
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

export async function APIGetCardbacks(): Promise<Array<string>> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/cardbacks/", {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.cardbacks;
}

export async function APISearch(
  searchSettings: SearchSettings,
  queriesToSearch: Array<SearchQuery>
): Promise<SearchResults> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/searchResults/", {
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

export async function APIGetSources(): Promise<SourceDocuments> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/sources/", {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetImportSites() {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/importSites", {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.import_sites;
}

export async function APIQueryImportSite(url: string): Promise<string> {
  const rawResponse = await fetch(
    "http://127.0.0.1:8000/2/importSiteDecklist/",
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

export async function APIGetDFCPairs(): Promise<DFCPairs> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/DFCPairs/", {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.dfc_pairs;
}

export async function APIGetPlaceholderText(): Promise<{
  [cardType: string]: Array<[number, string]>;
}> {
  const rawResponse = await fetch("http://127.0.0.1:8000/2/placeholderText/", {
    method: "GET",
    credentials: "same-origin",
    headers: getCSRFHeader(),
  });
  const content = await rawResponse.json();
  return content.cards;
}
