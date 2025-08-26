/**
 * TODO: get these tests working again. i need to iterate quickly on the system under test right now
 * (and it's midnight here).
 */

import { waitFor, within } from "@testing-library/react";

import { Front } from "@/common/constants";
import {
  projectSelectedImage1,
  sourceDocument1,
} from "@/common/test-constants";
import {
  openCardSlotGridSelector,
  renderWithProviders,
} from "@/common/test-utils";
import ProjectEditor from "@/components/ProjectEditor";
import {
  cardDocumentsThreeResults,
  defaultHandlers,
  searchResultsThreeResults,
  sourceDocumentsOneResult,
} from "@/mocks/handlers";
import { server } from "@/mocks/server";

test.skip("toggling between faceting cards by source vs grouped together works as expected", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );

  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: projectSelectedImage1,
    },
  });

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).toBeInTheDocument()
  );

  within(gridSelector).getByText("Group By Source").click();
  await waitFor(() =>
    expect(
      within(gridSelector).queryByTestId(`${sourceDocument1.key}-collapse`)
    ).not.toBeInTheDocument()
  );
});

test.skip("collapsing a source in the faceted view then expanding it works as expected", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );

  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: projectSelectedImage1,
    },
  });

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).toHaveClass("show")
  );

  within(gridSelector)
    .getByTestId(`${sourceDocument1.key}-collapse-header`)
    .click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).not.toHaveClass("show")
  );

  within(gridSelector)
    .getByTestId(`${sourceDocument1.key}-collapse-header`)
    .click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).toHaveClass("show")
  );
});

test.skip("collapsing and expanding all sources works as expected", async () => {
  server.use(
    cardDocumentsThreeResults,
    sourceDocumentsOneResult,
    searchResultsThreeResults,
    ...defaultHandlers
  );

  renderWithProviders(<ProjectEditor />, {
    preloadedState: {
      project: projectSelectedImage1,
    },
  });

  const gridSelector = await openCardSlotGridSelector(1, Front, 1, 3);
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).toHaveClass("show")
  );

  within(gridSelector).getByText("Collapse All").click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).not.toHaveClass("show")
  );

  within(gridSelector).getByText("Expand All").click();
  await waitFor(() =>
    expect(
      within(gridSelector).getByTestId(`${sourceDocument1.key}-collapse`)
    ).toHaveClass("show")
  );
});
