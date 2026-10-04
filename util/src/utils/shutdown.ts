/**
 * Process lifecycle — the single signal → shutdown path for every SeNARS binary.
 * @public
 */
export function setupGracefulShutdown(
  shutdownFn: () => Promise<void>,
  logger?: { info: (msg: string) => void }
): () => void {
  const handleShutdown = (signal: string) => {
    logger?.info(`Received ${signal}, shutting down...`);
    void shutdownFn().finally(() => process.exit(0));
  };
  const onInterrupt = (): void => handleShutdown('SIGINT');
  const onTerminate = (): void => handleShutdown('SIGTERM');

  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);

  return () => {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  };
}
