import { Command, Flags } from '@oclif/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';

export default class UpdateTsupConfig extends Command {
    static description = 'Update tsup.config.ts entry field based on provided patterns';

    static flags = {
        include: Flags.string({
            name: 'include',
            char: 'i',
            description: 'Glob pattern(s) to include',
            multiple: true,
            required: true,
        }),
        ignore: Flags.string({
            name: 'ignore',
            char: 'x',
            description: 'Glob pattern(s) to ignore',
            multiple: true,
            required: false,
        }),
    };

    async run() {
        const { flags } = await this.parse(UpdateTsupConfig);
        const includePatterns = flags.include;
        // Add test files and .d.ts files to ignore patterns
        const defaultIgnore = ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'];
        const ignorePatterns = [...defaultIgnore, ...(flags.ignore || [])];

        try {
            const files = globSync(includePatterns, { ignore: ignorePatterns });

            let tsupFile = readFileSync('tsup.config.ts', 'utf-8');
            tsupFile = tsupFile.replace(/entry: \[[^\]]*\],/, `entry: [${files.map((file) => `'${file}'`).join(',')}],`);

            writeFileSync('tsup.config.ts', tsupFile);
            this.log('Updated tsup.config.ts successfully.');
        } catch (error) {
            this.error(`Error during update: ${error}`);
        }
    }
}

UpdateTsupConfig.run();
