const vercelPrettier = require('@vercel/style-guide/prettier');
/** @type {import("prettier").Config} */
module.exports = {
    ...vercelPrettier,
    // add rules configurations here
    tabWidth: 4,
    printWidth: 160,
    semi: true,
    trailingComma: 'all',
};
