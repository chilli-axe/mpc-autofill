import { screen, waitFor } from "@testing-library/react";

import { cardDocument1, noBackend } from "@/common/test-constants";
import { renderWithProviders } from "@/common/test-utils";
import { DynamicLogo } from "@/features/ui/DynamicLogo";
import { defaultHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";

test("the html structure of the dynamic logo, backend configured", async () => {
  server.use(...defaultHandlers);
  const rendered = renderWithProviders(<DynamicLogo />);

  await waitFor(() =>
    expect(screen.getByAltText(cardDocument1.name)).toBeInTheDocument()
  );
  expect(rendered.getByTestId("dynamic-logo")).toMatchSnapshot();
});

test("the html structure of the dynamic logo, no backend configured", async () => {
  server.use(...defaultHandlers);
  const rendered = renderWithProviders(
    <DynamicLogo />,
    {
      preloadedState: { backend: noBackend },
    },
    false
  );

  await waitFor(() =>
    expect(screen.getAllByAltText("Your Design Here")).toHaveLength(5)
  );
  expect(rendered.getByTestId("dynamic-logo")).toMatchSnapshot();
});
