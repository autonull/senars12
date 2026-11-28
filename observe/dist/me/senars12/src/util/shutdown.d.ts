/**
 * Process lifecycle — the single signal → shutdown path for every SeNARS binary.
 * @public
 */
export declare function setupGracefulShutdown(shutdownFn: () => Promise<void>, logger?: {
    info: (msg: string) => void;
}): () => void;
//# sourceMappingURL=shutdown.d.ts.map