import { screen } from "@testing-library/react";

import App from "@/app/app";
import { cardDocument2, localBackend } from "@/common/test-constants";
import { openImportCSVModal, renderWithProviders } from "@/common/test-utils";

const preloadedState = {
  backend: localBackend,
  project: {
    members: [],
    cardback: cardDocument2.identifier,
  },
};

//# region snapshot tests

test("the html structure of CSV importer", async () => {
  renderWithProviders(<App />, { preloadedState });

  await openImportCSVModal();

  expect(screen.getByTestId("import-csv")).toMatchSnapshot();
});

//# endregion
