import { expect } from "@playwright/test";

import { cardDocument1 } from "@/common/test-constants";
import { defaultHandlers } from "@/mocks/handlers";

import { test } from "../../playwright.setup";
import { configureDefaultBackend } from "../test-utils";

test.describe("DynamicLogo visual tests", () => {
  test("dynamic logo, backend configured", async ({ page, network }) => {
    network.use(...defaultHandlers);
    await page.goto("/");
    await configureDefaultBackend(page);

    await expect(page.getByAltText(cardDocument1.name)).toBeVisible();

    await expect(page.getByTestId("dynamic-logo")).toMatchAriaSnapshot(`
      - paragraph: Test Site
      - img "logo-arrow"
      - img "Card 6"
      - img "Card 1"
      - img "Card 2"
      - img "Card 3"
      - img "Card 4"
    `);
  });

  test("dynamic logo, no backend configured", async ({ page, network }) => {
    network.use(...defaultHandlers);
    await page.goto("/");

    // Wait for the default "Your Design Here" images to load
    await expect(page.getByAltText("Your Design Here").first()).toBeVisible();

    await expect(page.getByTestId("dynamic-logo")).toMatchAriaSnapshot(`
      - paragraph: MPC Autofill
      - img "logo-arrow"
      - img "Your Design Here"
      - img "Your Design Here"
      - img "Your Design Here"
      - img "Your Design Here"
      - img "Your Design Here"
    `);
  });
});
