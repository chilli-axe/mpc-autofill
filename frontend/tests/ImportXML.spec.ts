import { expect } from "@playwright/test";

import { S30, SelectedImageSeparator } from "@/common/constants";
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
  importText,
  importXML,
  navigateToEditor,
} from "./test-utils";

test.describe("ImportXML", () => {
  test("importing one card by XML into an empty project", async ({
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

    await importXML(
      page,
      `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
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
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing multiple instances of one card by XML into an empty project", async ({
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

    await importXML(
      page,
      `<order>
      <details>
        <quantity>2</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
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

  test("importing one specific card version by XML into an empty project", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    await importXML(
      page,
      `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    await importXML(
      page,
      `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>query 1</query>
        </card>
        <card>
          <id>${cardDocument6.identifier}</id>
          <slots>1</slots>
          <name>${cardDocument6.name}</name>
          <query>t:query 6</query>
        </card>
        <card>
          <id>${cardDocument5.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument5.name}</name>
          <query>b:query 5</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
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
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
        {
          slot: 2,
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
        {
          slot: 3,
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing a more complex XML into an empty project", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    await importXML(
      page,
      `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
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

  test("importing an XML with gaps into an empty project", async ({
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

    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);

    await importXML(
      page,
      `<order>
      <details>
        <quantity>4</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>3</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,3</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument2.identifier}</cardback>
    </order>`
    );

    await expectCardSlotToExist(page, 1);
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
          slot: 4,
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
          name: cardDocument2.name,
          selectedImage: 1,
          totalImages: 2,
        },
        {
          slot: 4,
          name: cardDocument4.name,
          selectedImage: 4,
          totalImages: 4,
        },
      ]
    );
    await expectCardSlotToExist(page, 3);
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("importing a more complex XML into a non-empty project", async ({
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
          totalImages: 4,
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

    // import a few more cards
    await importXML(
      page,
      `<order>
      <details>
        <quantity>3</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument3.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument3.name}</name>
          <query>my search query</query>
        </card>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>2</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <backs>
        <card>
          <id>${cardDocument4.identifier}</id>
          <slots>0,1</slots>
          <name>${cardDocument4.name}</name>
          <query>my search query</query>
        </card>
      </backs>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`
    );

    await expectCardGridSlotStates(
      page,
      [
        {
          slot: 2,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 4,
        },
        {
          slot: 3,
          name: cardDocument3.name,
          selectedImage: 3,
          totalImages: 4,
        },
        {
          slot: 4,
          name: cardDocument1.name,
          selectedImage: 1,
          totalImages: 4,
        },
      ],
      [
        {
          slot: 2,
          name: cardDocument4.name,
          selectedImage: 4,
          totalImages: 4,
        },
        {
          slot: 3,
          name: cardDocument4.name,
          selectedImage: 4,
          totalImages: 4,
        },
        {
          slot: 4,
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument2.name, 1, 2);
  });

  test("import an XML and retain its cardback", async ({ page, network }) => {
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

    await importXML(
      page,
      `<order>
      <details>
        <quantity>1</quantity>
        <bracket>18</bracket>
        <stock>${S30}</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>${cardDocument1.identifier}</id>
          <slots>0</slots>
          <name>${cardDocument1.name}</name>
          <query>my search query</query>
        </card>
      </fronts>
      <cardback>${cardDocument3.identifier}</cardback>
    </order>`,
      true
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
          name: cardDocument3.name,
          selectedImage: 2,
          totalImages: 2,
        },
      ]
    );
    await expectCardbackSlotState(page, cardDocument3.name, 2, 2);
  });
});
