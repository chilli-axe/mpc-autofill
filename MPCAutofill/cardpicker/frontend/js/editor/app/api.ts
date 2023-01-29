// TODO: set up the below API calls to use best practices with handling all cases `fetch` can return
import Cookies from "js-cookie";
import { CSRFToken } from "../common/constants";
import {
  SearchSettingsState,
  CardDocuments,
  SearchResults,
  SourceDocuments,
  SearchQuery,
  DFCPairs,
} from "../common/types";

export async function APIGetCards(
  identifiersToSearch: Set<string>
): Promise<CardDocuments> {
  const rawResponse = await fetch("/2/getCards/", {
    method: "POST",
    body: JSON.stringify({
      card_identifiers: Array.from(identifiersToSearch),
    }),
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetCardbacks(): Promise<Array<string>> {
  const rawResponse = await fetch("/2/getCardbacks/", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.cardbacks;
}

export async function APISearch(
  searchSettings: SearchSettingsState,
  queriesToSearch: Array<SearchQuery>
): Promise<SearchResults> {
  const rawResponse = await fetch("/2/search/", {
    method: "POST",
    body: JSON.stringify({
      searchSettings,
      queries: Array.from(queriesToSearch),
    }),
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetSources(): Promise<SourceDocuments> {
  const rawResponse = await fetch("/2/getSources/", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.results;
}

export async function APIGetImportSites() {
  const rawResponse = await fetch("/2/getImportSites", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.import_sites;
}

export async function APIQueryImportSite(url: string): Promise<string> {
  const rawResponse = await fetch("/2/queryImportSite/", {
    method: "POST",
    body: JSON.stringify({ url }),
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.cards;
}

export async function APIGetDFCPairs(): Promise<DFCPairs> {
  const rawResponse = await fetch("/2/getDFCPairs/", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": Cookies.get(CSRFToken),
    },
  });
  const content = await rawResponse.json();
  return content.dfc_pairs;
}
