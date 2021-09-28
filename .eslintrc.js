module.exports = {
  env: {
    browser: true,
  },
  extends: ["@saberhq/eslint-config-react"],
  settings: { react: { version: "detect" } },
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "tsconfig.json",
  },
};
