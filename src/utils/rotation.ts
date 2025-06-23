/// <reference lib="dom" />
import dayjs from 'dayjs';
import { merge } from 'merge-anything';
import { createStream, RotatingFileStream, type Generator, type Options } from 'rotating-file-stream';

export type RotationOptions = Omit<Options, 'path' | 'compress' | 'teeToStdout'> & {
    path: string;
    filenamePrefix: string;
    extension: string;
    generator?: Generator;
};

let options: RotationOptions | null = null;

let rotation: RotatingFileStream | null = null;

const generator: Generator = (time: number | Date, index?: number) => {
    if (!time) return `${options?.filenamePrefix ?? 'output'}.${options?.extension ?? 'log'}`;
    const date = dayjs(time);
    const folder = date.format('YYYY-MM');
    return `${folder}/${options?.filenamePrefix ?? 'output'}-${date.format('YYYY-MM-DD')}-${index ?? 0}.${options?.extension ?? 'log'}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ok
export function logToFile(opts: RotationOptions, arg: any) {
    if (globalThis.window) {
        return;
    }
    if (!rotation) {
        options = merge(
            {
                path: '.smooai-logs',
                filenamePrefix: 'output',
                extension: 'log',
            },
            options ?? {},
            opts,
        );
        const { filenamePrefix: _filenamePrefix, extension: _extension, ...rest } = options;
        rotation = createStream(options.generator ?? generator, rest);
    }
    rotation.write(arg);
}
