import { within } from "@testing-library/dom";
import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import Cookies from "js-cookie";

import App from "@/app/app";
import { GoogleAnalyticsConsentKey } from "@/common/constants";
import {
  configureDefaultBackend,
  getAddCardsMenu,
  getErrorToast,
  importText,
  openImportTextModal,
  renderWithProviders,
} from "@/common/test-utils";
import { NewCards } from "@/features/new/new";
import {
  cardbacksServerError,
  cardbacksTwoOtherResults,
  cardbacksTwoResults,
  cardDocumentsServerError,
  cardDocumentsThreeResults,
  defaultHandlers,
  dfcPairsServerError,
  importSitesServerError,
  newCardsFirstPageServerError,
  sampleCardsServerError,
  searchResultsOneResult,
  searchResultsServerError,
  sourceDocumentsOneResult,
  sourceDocumentsServerError,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";
import About from "@/pages/about";

describe("google analytics toast", () => {
  beforeEach(() => {
    Cookies.remove(GoogleAnalyticsConsentKey);
    // @ts-ignore
    delete window.gtag;
  });
  afterEach(() => {
    Cookies.remove(GoogleAnalyticsConsentKey);
    // @ts-ignore
    delete window.gtag;
  });

  test("opting into google analytics", async () => {
    renderWithProviders(<About />);
    await waitFor(() => {
      expect(screen.getByText("Cookie Usage")).not.toBeNull();
    });

    screen.getByText("That's fine!").click();
    await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

    // upon reloading the page, google analytics should now be turned on
    renderWithProviders(<About />);
    expect(eval("gtag")).toBeDefined();
  });

  test("opting out of google analytics", async () => {
    renderWithProviders(<About />);
    await waitFor(() => {
      expect(screen.getByText("Cookie Usage")).not.toBeNull();
    });

    screen.getByText("Opt out").click();
    await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

    // upon reloading the page, google analytics should now be turned off
    renderWithProviders(<About />);
    expect(() => eval("gtag")).toThrow();
  });

  test("google analytics consent popup does not appear once consent is specified", async () => {
    renderWithProviders(<About />);
    await waitFor(() =>
      expect(screen.getByText("Cookie Usage")).not.toBeNull()
    );

    screen.getByText("That's fine!").click();
    await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

    // the popup should no longer appear upon page reload
    await waitFor(() =>
      expect(screen.queryByText("Cookie Usage")).not.toBeInTheDocument()
    );
  });
});

describe("error reporting toasts", () => {
  async function assertErrorToast(
    name: string,
    interactionFn: any | null = null
  ) {
    await configureDefaultBackend();

    // do any extra setup the test needs to do to trigger the error
    if (interactionFn != null) {
      await interactionFn();
    }

    const errorToast = await getErrorToast();

    // assert the toast's reported error name and message
    expect(errorToast).not.toBeNull();
    expect(within(errorToast).getByText(name)).toBeInTheDocument();
    expect(
      within(errorToast).getByText("A message that describes the error")
    ).toBeInTheDocument();

    // dismiss the toast, then assert that it no longer exists
    within(errorToast).getByLabelText("Close").click();
    await waitFor(() =>
      expect(screen.queryByText("An Error Occurred")).not.toBeInTheDocument()
    );
  }

  test("/2/searchResults", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsServerError,
      ...defaultHandlers
    );
    renderWithProviders(<App />, {
      preloadedState: { toasts: { notifications: {} } },
    });
    await assertErrorToast("2/searchResults", async () => {
      await importText("mountain");
    });
  });

  test("/2/cards", async () => {
    server.use(
      cardDocumentsServerError,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    renderWithProviders(<App />, {
      preloadedState: { toasts: { notifications: {} } },
    });
    await assertErrorToast("2/cards");
  });

  test("/2/sources", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsServerError,
      searchResultsOneResult,
      ...defaultHandlers
    );
    renderWithProviders(<App />, { preloadedState: {} });
    await assertErrorToast("2/sources");
  });

  test("/2/DFCPairs", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      dfcPairsServerError,
      ...defaultHandlers
    );
    renderWithProviders(<App />);
    await assertErrorToast("2/DFCPairs", async () => {
      // DFC pairs are loaded when an importer is opened
      await openImportTextModal();
    });
  });

  test("/2/cardbacks", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksServerError,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    renderWithProviders(<App />);
    await assertErrorToast("2/cardbacks");
  });

  test("/2/importSites", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      importSitesServerError,
      ...defaultHandlers
    );
    renderWithProviders(<App />);
    await assertErrorToast("2/importSites", async () => {
      const addCardsMenu = getAddCardsMenu();
      addCardsMenu.click();
    });
  });

  test("/2/sampleCards", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      sampleCardsServerError,
      ...defaultHandlers
    );
    renderWithProviders(<App />);
    await assertErrorToast("2/sampleCards", async () => {
      // DFC pairs are loaded when the text importer is opened
      await openImportTextModal();
    });
  });

  test("/2/newCardsFirstPage", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      newCardsFirstPageServerError,
      ...defaultHandlers
    );
    renderWithProviders(<NewCards />);
    await assertErrorToast("2/newCardsFirstPage");
  });
});
