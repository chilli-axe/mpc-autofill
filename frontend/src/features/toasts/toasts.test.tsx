import { within } from "@testing-library/dom";
import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import Cookies from "js-cookie";
// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";

import App from "@/app/app";
import { GoogleAnalyticsConsentKey } from "@/common/constants";
import {
  configureDefaultBackend,
  getErrorToast,
  openImportTextModal,
  openImportURLModal,
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

import { LayoutWithoutProvider } from "../ui/layout";

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

  const AboutWithToasts = () => (
    <LayoutWithoutProvider>
      <About />
    </LayoutWithoutProvider>
  );

  test("opting into google analytics", async () => {
    renderWithProviders(<AboutWithToasts />);
    await waitFor(() => {
      expect(screen.getByText("Cookie Usage")).not.toBeNull();
    });

    screen.getByText("That's fine!").click();
    await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

    // upon reloading the page, google analytics should now be turned on
    renderWithProviders(<AboutWithToasts />);
    expect(eval("gtag")).toBeDefined();
  });

  test("opting out of google analytics", async () => {
    renderWithProviders(<AboutWithToasts />);
    await waitFor(() => {
      expect(screen.getByText("Cookie Usage")).not.toBeNull();
    });

    screen.getByText("Opt out").click();
    await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

    // upon reloading the page, google analytics should now be turned off
    renderWithProviders(<AboutWithToasts />);
    expect(() => eval("gtag")).toThrow();
  });

  test("google analytics consent popup does not appear once consent is specified", async () => {
    renderWithProviders(<AboutWithToasts />);
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
  beforeAll(() => {
    // we cannot use MSW to mock this ping out because ping.js works by loading favicon.ico as an image
    // therefore, we need to mock the ping implementation such that the server is always "alive"
    // typing these with `any` is pretty lazy but this is just in the test framework so who cares tbh
    jest
      .spyOn(Ping.prototype, "ping")
      .mockImplementation(function (source: any, callback: any) {
        return callback(null); // null indicates no error -> successful ping
      });
  });

  afterAll(() => {
    jest.spyOn(Ping.prototype, "ping").mockRestore();
  });

  async function renderAppAndAssertErrorToast(
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

  // Note: we're assuming that pages will be wrapped in `LayoutWithoutProvider`
  const AppWithToasts = () => (
    <LayoutWithoutProvider>
      <App />
    </LayoutWithoutProvider>
  );
  const NewCardsWithToasts = () => (
    <LayoutWithoutProvider>
      <NewCards />
    </LayoutWithoutProvider>
  );

  test("/2/searchResults", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsOneResult,
      searchResultsServerError,
      ...defaultHandlers
    );
    renderWithProviders(<AppWithToasts />, {
      preloadedState: { toasts: { errors: {} } },
    });
    await renderAppAndAssertErrorToast("2/searchResults");
  });

  test("/2/cards", async () => {
    server.use(
      cardDocumentsServerError,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    renderWithProviders(<AppWithToasts />, {
      preloadedState: { toasts: { errors: {} } },
    });
    await renderAppAndAssertErrorToast("2/cards");
  });

  test("/2/sources", async () => {
    server.use(
      cardDocumentsThreeResults,
      cardbacksTwoResults,
      sourceDocumentsServerError,
      searchResultsOneResult,
      ...defaultHandlers
    );
    renderWithProviders(<AppWithToasts />, { preloadedState: {} });
    await renderAppAndAssertErrorToast("2/sources");
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
    renderWithProviders(<AppWithToasts />);
    await renderAppAndAssertErrorToast("2/DFCPairs", async () => {
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
    renderWithProviders(<AppWithToasts />);
    await renderAppAndAssertErrorToast("2/cardbacks");
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
    renderWithProviders(<AppWithToasts />);
    await renderAppAndAssertErrorToast("2/importSites", async () => {
      // import sites are loaded when the URL importer is opened
      await openImportURLModal();
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
    renderWithProviders(<AppWithToasts />);
    await renderAppAndAssertErrorToast("2/sampleCards", async () => {
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
    renderWithProviders(<NewCardsWithToasts />);
    await renderAppAndAssertErrorToast("2/newCardsFirstPage");
  });
});
