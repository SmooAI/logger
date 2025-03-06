// json-decycle.d.ts
declare global {
    interface JSON {
        /**
         * Removes circular references from an object so that it can be serialized
         * using JSON.stringify. Circular references are replaced with a placeholder.
         *
         * @param obj The object to be decycled.
         * @param replacer An optional function that alters the behavior of the
         * stringification process.
         * @returns The decycled object.
         */
        decycle(obj: any, replacer?: (key: string, value: any) => any): any;
    }
}

// Export to make sure it works as a module augmentation
export {};
