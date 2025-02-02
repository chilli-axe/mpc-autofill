module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  settings: {
    next: {
      rootDir: "schemas/",
    },
  },
  plugins: ["simple-import-sort"],
  rules: {
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
  },
};
