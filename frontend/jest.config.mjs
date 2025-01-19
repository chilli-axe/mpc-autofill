import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: [
    "<rootDir>/jest.setup.ts",
    "jsdom-worker",
    "next-router-mock",
  ],

  // https://mswjs.io/docs/migrations/1.x-to-2.x#requestresponsetextencoder-is-not-defined-jest
  testEnvironment: "jest-fixed-jsdom",
  // https://mswjs.io/docs/migrations/1.x-to-2.x#cannot-find-module-mswnode-jsdom
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  runtime: "@side/jest-runtime",
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  injectGlobals: true,
  testTimeout: 20_000,
  maxWorkers: 4,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
