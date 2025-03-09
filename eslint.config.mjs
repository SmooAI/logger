import { config as configBase } from '@smooai/config-eslint';

/** @type {import("eslint").Linter.Config} */
export default [
    ...configBase,
    {
        rules: {
            'turbo/no-undeclared-env-vars': 'off',
        },
    },
];
