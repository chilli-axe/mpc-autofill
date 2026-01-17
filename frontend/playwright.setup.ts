import { createNetworkFixture, type NetworkFixture } from "@msw/playwright";
import { test as testBase } from "@playwright/test";

interface Fixtures {
  network: NetworkFixture;
}

export const test = testBase.extend<Fixtures>({
  // Create a fixture that will control the network in your tests.
  network: createNetworkFixture({
    initialHandlers: [],
  }),
});
