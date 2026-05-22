import next from "eslint-config-next";

/**
 * ESLint flat config. `eslint-config-next` (v16) is itself a flat-config array
 * bundling the Next.js, React, TypeScript, import and a11y rule sets.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const eslintConfig = [
  ...next,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "lib/generated/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
