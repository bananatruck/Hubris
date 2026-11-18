const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = [
    { ignores: ['dist/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,mts}'] })),
    { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
];
