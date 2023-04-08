// The below can be used in a Jest global setup file or similar for your testing set-up
import { loadEnvConfig } from "@next/env";

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
