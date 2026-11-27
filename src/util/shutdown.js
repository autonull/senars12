/**
 * Process lifecycle — the single signal → shutdown path for every SeNARS binary.
 * @public
 */
export function setupGracefulShutdown(shutdownFn, logger) {
    const handleShutdown = (signal) => {
        logger?.info(`Received ${signal}, shutting down...`);
        void shutdownFn().finally(() => process.exit(0));
    };
    const onInterrupt = () => handleShutdown('SIGINT');
    const onTerminate = () => handleShutdown('SIGTERM');
    process.on('SIGINT', onInterrupt);
    process.on('SIGTERM', onTerminate);
    return () => {
        process.off('SIGINT', onInterrupt);
        process.off('SIGTERM', onTerminate);
    };
}
