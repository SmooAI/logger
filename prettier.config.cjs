/* eslint-disable no-undef -- ok */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- ok
const vercelPrettier = require('@vercel/style-guide/prettier');
/** @type {import("prettier").Config} */
module.exports = {
    ...vercelPrettier,
    // add rules configurations here
    tabWidth: 4,
    printWidth: 160,
    semi: true,
    trailingComma: 'all',
    plugins: ['@ianvs/prettier-plugin-sort-imports', 'prettier-plugin-packagejson', 'prettier-plugin-css-order', 'prettier-plugin-tailwindcss'],
};
