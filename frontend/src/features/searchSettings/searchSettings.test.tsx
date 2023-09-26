import { waitFor, within } from "@testing-library/dom";

import App from "@/app/app";
import { Front } from "@/common/constants";
import {
  cardDocument1,
  localBackend,
  sourceDocument1,
} from "@/common/test-constants";
import {
  expectCardGridSlotState,
  importText,
  openSearchSettingsModal,
  renderWithProviders,
} from "@/common/test-utils";
import {
  cardbacksOneResult,
  cardDocumentsOneResult,
  defaultHandlers,
  searchResultsOneResult,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

//# region snapshot tests

test("the html structure of search settings", async () => {
  server.use(
    cardDocumentsOneResult,
    cardbacksOneResult,
    sourceDocumentsThreeResults,
    searchResultsOneResult,
    ...defaultHandlers
  );
  const { container } = renderWithProviders(<App />, {
    preloadedState: {
      backend: localBackend,
      project: { members: [], cardback: null },
    },
  });

  // we need to wait for a second here after rendering to ensure sources have been fetched
  // searching for a card here isn't strictly necessary for the snapshot test,
  // but it's a convenient way to ensure that sources have been fetched
  await importText("my search query");
  await expectCardGridSlotState(1, Front, cardDocument1.name, 1, 1);

  const searchSettings = await openSearchSettingsModal();
  await waitFor(() => within(searchSettings).getByText(sourceDocument1.name));
  // the below line waits until all multi-select elements have finished loading
  await waitFor(() => container.querySelectorAll(".spinner").length === 0);
  expect(searchSettings).toMatchSnapshot();
});

//# endregion
