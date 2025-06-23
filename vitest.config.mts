import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        passWithNoTests: true,
        env: {
            FORCE_COLOR: '1',
        },
    },
});
