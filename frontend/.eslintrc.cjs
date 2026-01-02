module.exports = {
  extends: ["next/core-web-vitals"],
  settings: {
    next: {
      rootDir: "frontend/",
    },
  },
  plugins: ["simple-import-sort"],
  rules: {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
  },
};
