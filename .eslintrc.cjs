"use strict";

require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  env: {
    browser: true,
  },
  extends: ["@saberhq/eslint-config-react"],
  settings: { react: { version: "detect" } },
  parserOptions: {
    project: "tsconfig.json",
  },
};
