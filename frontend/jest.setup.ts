// The below can be used in a Jest global setup file or similar for your testing set-up
import "@testing-library/jest-dom";
import "jest-styled-components";
// Polyfill "window.fetch" used in the React component.
import "whatwg-fetch";

import { loadEnvConfig } from "@next/env";
import { configure as configureDom } from "@testing-library/dom";
import { configure as configureReact } from "@testing-library/react";
// TODO: https://github.com/alfg/ping.js/issues/29#issuecomment-487240910
// @ts-ignore
import Ping from "ping.js";

import { server } from "@/mocks/server";

configureReact({ asyncUtilTimeout: 10_000 });
configureDom({ asyncUtilTimeout: 10_000 });

// retrieved from https://stackoverflow.com/a/68539103/13021511
global.matchMedia =
  global.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

export default async () => {
  const projectDir = process.cwd();
  loadEnvConfig(projectDir);
};

// Establish API mocking before all tests.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });

  // we cannot use MSW to mock this ping out because ping.js works by loading favicon.ico as an image
  // therefore, we need to mock the ping implementation such that the server is always "alive"
  // typing these with `any` is pretty lazy but this is just in the test framework so who cares tbh
  jest
    .spyOn(Ping.prototype, "ping")
    .mockImplementation(function (source: any, callback: any) {
      return callback(null); // null indicates no error -> successful ping
    });
});

beforeEach(() => {
  // IntersectionObserver isn't available in test environment
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => {
  server.resetHandlers();
  jest.restoreAllMocks();
});

// Clean up after the tests are finished.
afterAll(() => {
  server.close();

  jest.spyOn(Ping.prototype, "ping").mockRestore();
});
