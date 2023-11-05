import { waitFor, within } from "@testing-library/dom";
import { screen } from "@testing-library/react";

import App from "@/app/app";
import { cardDocument5, localBackend } from "@/common/test-constants";
import {
  expectCardSlotToExist,
  importText,
  renderWithProviders,
} from "@/common/test-utils";
import { LayoutWithoutProvider } from "@/features/ui/layout";
import {
  cardDocumentsSixResults,
  defaultHandlers,
  searchResultsSixResults,
  sourceDocumentsThreeResults,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

test("invalidIdentifiersModal displays the appropriate data", async () => {
  server.use(
    cardDocumentsSixResults,
    sourceDocumentsThreeResults,
    searchResultsSixResults,
    ...defaultHandlers
  );
  renderWithProviders(
    <LayoutWithoutProvider>
      <App />
    </LayoutWithoutProvider>,
    {
      preloadedState: {
        backend: localBackend,
        project: {
          members: [],
          cardback: cardDocument5.identifier,
        },
      },
    }
  );
  await importText("2x query 1@123\n1 query 2|query 3@456");
  await expectCardSlotToExist(1);
  await expectCardSlotToExist(2);
  await expectCardSlotToExist(3);

  // bring up the modal
  const alertText = screen.getByText("Your project specified", {
    exact: false,
  });
  within(alertText.parentElement!).getByText("Review Invalid Cards").click();
  await waitFor(() =>
    expect(screen.getByText("Invalid Cards")).toBeInTheDocument()
  );

  // assert the contents of the modal
  const modalText = screen.getByText(
    "Some card versions you specified couldn't be found. Sorry about that!",
    { exact: false }
  );
  expect(modalText.parentElement!.parentElement!).toMatchSnapshot();
});
