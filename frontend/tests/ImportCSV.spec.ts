import { expect } from "@playwright/test";

import {
  cardDocument1,
  cardDocument2,
  cardDocument3,
  cardDocument4,
  cardDocument5,
  cardDocument6,
} from "@/common/test-constants";
import {
  cardbacksTwoOtherResults,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsFourResults,
  searchResultsOneResult,
  searchResultsSixResults,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  configureDefaultBackend,
  expectCardbackSlotState,
  expectCardGridSlotStates,
  expectCardSlotToExist,
  importCSV,
  navigateToEditor,
} from "./test-utils";

test.describe("ImportCSV", () => {
  test("importing one card by CSV into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity,Front
    ,my search query`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing multiple instances of one card by CSV into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsOneResult,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity,Front
    2,my search query`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
        {
          slot: 2,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
        {
          slot: 2,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing one specific card version by CSV into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity,Front,Front ID
    ,my search query,${cardDocument3.identifier}`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 3,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing one card of each type into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksTwoOtherResults,
      sourceDocumentsThreeResults,
      searchResultsSixResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity,Front
    ,query 1\n,t:query 6\n,b:query 5`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
        {
          slot: 2,
          name: cardDocument6.name,
          selectedImage: 1,
          totalImages: 1,
        },
        {
          slot: 3,
          name: cardDocument5.name,
          selectedImage: 1,
          totalImages: 1,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
        {
          slot: 2,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
        {
          slot: 3,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing a more complex CSV into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsSixResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsFourResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity,Front,Front ID,Back,Back ID
    2,my search query,${cardDocument3.identifier},my search query,${cardDocument4.identifier}
    ,my search query`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 4,
        },
        {
          slot: 2,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 4,
        },
        {
          slot: 3,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 4,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument4.name,
          selectedImage: 4,
          totalImages: 4,
        },
        {
          slot: 2,
          name: cardDocument4.name,
          selectedImage: 4,
          totalImages: 4,
        },
        {
          slot: 3,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("CSV header has spaces", async ({ page, network }) => {
    network.use(
      cardDocumentsThreeResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsThreeResults,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await importCSV(
      page,
      `Quantity, Front , Front ID
    ,my search query,${cardDocument3.identifier}`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 1,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 3,
        },
      ],
      [
        {
          slot: 1,
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });
});
