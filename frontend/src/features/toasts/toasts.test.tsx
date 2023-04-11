import { renderWithProviders } from "@/common/test-utils";
import Cookies from "js-cookie";
// these tests assume that the toast appears on any page and therefore render the simplest page possible
import About from "@/pages/about";
import {
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { GoogleAnalyticsConsentCookie } from "@/common/constants";

beforeEach(() => {
  Cookies.remove(GoogleAnalyticsConsentCookie);
  // @ts-ignore
  delete window.gtag;
});
afterEach(() => {
  Cookies.remove(GoogleAnalyticsConsentCookie);
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
  await waitFor(() => expect(screen.getByText("Cookie Usage")).not.toBeNull());

  screen.getByText("That's fine!").click();
  await waitForElementToBeRemoved(() => screen.getByText("Cookie Usage"));

  // the popup should no longer appear upon page reload
  await waitFor(() =>
    expect(screen.queryByText("Cookie Usage")).not.toBeInTheDocument()
  );
});
