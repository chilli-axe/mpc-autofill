import { expect } from "@playwright/test";

import { SelectedImageSeparator } from "@/common/constants";
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
  cardDocumentsFourResults,
  cardDocumentsSixResults,
  cardDocumentsThreeResults,
  defaultHandlers,
  dfcPairsMatchingCards1And4,
  sampleCards,
  searchResultsForDFCMatchedCards1And4,
  searchResultsOneResult,
  searchResultsSixResults,
  sourceDocumentsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";

import { test } from "../playwright.setup";
import {
  configureDefaultBackend,
  expectCardbackSlotState,
  expectCardGridSlotStates,
  expectCardSlotToExist,
  expectCardSlotToNotExist,
  importText,
  navigateToEditor,
  openImportTextModal,
} from "./test-utils";

test.describe("ImportText", () => {
  test("importing one card by text into an empty project", async ({
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
    await importText(page, "my search query");
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
  });

  test("importing multiple instances of one card by text into an empty project", async ({
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

    // import two instances of a card
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    await importText(page, "2x my search query");

    // two card slots should have been created
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
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2); // should not have changed
  });

  test("importing multiple instances of one card without an x by text into an empty project", async ({
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

    // import two instances of a card without an x
    await importText(page, "2 my search query");

    // two card slots should have been created
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

  test("importing multiple instances of one card with a capital X by text into an empty project", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // import two instances of a card with a capital X
    await importText(page, "2X my search query");

    // two card slots should have been created
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
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2); // should not have changed
  });

  test("importing multiple instances of one card by text into a non-empty project", async ({
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

    // this used to preload the redux state, but with the shift to listeners,
    // we have to add the first card manually like this.
    await importText(
      page,
      `1x my search query${SelectedImageSeparator}${cardDocument1.identifier}`
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

    // import two instances of a card
    await importText(page, "2x my search query");

    // two card slots should have been created
    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 2,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
        {
          slot: 3,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 1,
        },
      ],
      [
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // import one card of each type
    await importText(page, "query 1\nt:query 6\nb:query 5");

    // three card slots should have been created
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2); // should not have changed
  });

  test("importing one DFC-paired card by text into an empty project", async ({
    page,
    network,
  }) => {
    network.use(
      cardDocumentsFourResults,
      cardbacksTwoOtherResults,
      sourceDocumentsOneResult,
      searchResultsForDFCMatchedCards1And4,
      dfcPairsMatchingCards1And4,
      ...defaultHandlers
    );
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // import one instance of a double faced card
    await importText(page, "my search query");

    // we should now have both sides of that DFC pair in slot 1
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
          name: cardDocument4.name,
          selectedImage: 1,
          totalImages: 1,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2); // should not have changed
  });

  test("importing an empty string by text into an empty project", async ({
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

    await importText(page, "");

    await expectCardSlotToNotExist(page, 1);
  });

  test("the placeholder text of the text importer", async ({
    page,
    network,
  }) => {
    network.use(sampleCards, ...defaultHandlers);
    page.addInitScript({ content: "Math.random = () => 1;" });
    await page.goto("/");
    await configureDefaultBackend(page);
    await navigateToEditor(page);

    await openImportTextModal(page);
    await expect(page.getByTestId("import-text")).toMatchAriaSnapshot(`
    - paragraph: Type the names of the cards you'd like to add to your order and hit Submit. One card per line.
    - heading "Syntax Guide" [level=2]:
      - button "Syntax Guide"
    - textbox "import-text":
      - /placeholder: "4x ${cardDocument1.name}\\n4x ${cardDocument2.name}\\n4x ${cardDocument3.name}\\n4x ${cardDocument4.name}\\n\\n4x t:${cardDocument6.name}\\n\\n4x b:${cardDocument5.name}"
    - paragraph: "Hint: Submit with Control+Enter."
    `);
  });

  test("the textbox should clear itself after submitting a list", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // import a card
    await importText(page, "my search query");

    // a card slot should have been created
    expectCardSlotToExist(page, 1);

    // open the window again and assert that the textbox is empty
    await openImportTextModal(page);
    await expect(
      page.getByRole("textbox", { name: "import-text" })
    ).toHaveValue("");
  });

  test("the textbox should not clear itself until the form has been submitted", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // open the window and set some text
    await openImportTextModal(page);
    await page.getByRole("textbox", { name: "import-text" }).fill("big test");

    // close the window and reopen it
    await page.getByRole("button", { name: "import-text-close" }).click();
    await openImportTextModal(page);
    await expect(
      page.getByRole("textbox", { name: "import-text" })
    ).toHaveValue("big test");
  });

  test("pressing ctrl+enter while focused on the textarea should submit the form", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    // import a card, submitting the form with ctrl+enter
    await openImportTextModal(page);
    await page.getByRole("textbox", { name: "import-text" }).click();
    await page
      .getByRole("textbox", { name: "import-text" })
      .fill("my search query");
    await page.keyboard.press("Control+Enter");

    // a card slot should have been created
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
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2); // should not have changed
  });
});
