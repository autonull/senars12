export interface ValidationResult {
    readonly unknown: ReadonlyArray<string>;
    readonly mistyped: ReadonlyArray<{
        name: string;
        reason: string;
    }>;
}
/** Names sorted: the iteration source is the env table, whose order is whoever
 *  populated it — a shell, `--env-file`, a test that deletes and re-sets. A report
 *  that reorders between runs of the same config cannot be diffed. */
export declare const validateEnv: () => ValidationResult;
export declare const assertValidEnv: () => void;
//# sourceMappingURL=env-validate.d.ts.map