import cjs from "@cto.af/eslint-config/cjs.js";
import mocha from "@cto.af/eslint-config/mocha.js"
import mod from "@cto.af/eslint-config/module.js";

export default [
  {
    ignores: [
      "coverage/**",
      "docs/**",
      "node_modules/**",
      "**/*.d.ts",
    ],
  },
  ...mod,
  ...cjs,
  ...mocha,
];
