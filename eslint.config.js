import base from '@cto.af/eslint-config';
import cjs from '@cto.af/eslint-config/cjs.js';
import mod from '@cto.af/eslint-config/module.js';

export default [
  {
    ignores: [
      'coverage/**',
      'docs/**',
      'node_modules/**',
      '**/*.d.ts',
    ],
  },
  ...base,
  ...mod,
  ...cjs,
];
