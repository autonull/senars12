/** Find a bundle directory by run ID. */
export declare function findBundle(runId: string): string | null;
/** Find all bundle directories matching a prefix. */
export declare function findBundles(prefix: string): string[];
/** Read a JSON file from a bundle, returning null if not found. */
export declare function readBundleJSON<T>(bundleDir: string, filename: string): Promise<T | null>;
/** Read a JSONL file from a bundle, returning parsed lines. */
export declare function readBundleJSONL<T>(bundleDir: string, filename: string): Promise<T[]>;
//# sourceMappingURL=bundle.d.ts.map