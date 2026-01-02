import nextJest from "next/jest.js";

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
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
  snapshotSerializers: [
    "@emotion/jest/serializer" /* if needed other snapshotSerializers should go here */,
  ],
};

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

const jestConfigWithOverrides = async (...args) => {
  const fn = createJestConfig(customJestConfig);
  const res = await fn(...args);

  res.transformIgnorePatterns = res.transformIgnorePatterns.map((pattern) => {
    if (pattern === "/node_modules/") {
      return "node_modules/(?!(until-async)|(node-fetch)|(data-uri-to-buffer)|(fetch-blob)|(formdata-polyfill)/)";
    }
    return pattern;
  });

  return res;
};

export default jestConfigWithOverrides;
