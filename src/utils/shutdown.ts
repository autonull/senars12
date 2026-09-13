/**
 * Graceful shutdown utility for SeNARS processes
 */

export function setupGracefulShutdown(
  shutdownFn: () => Promise<void>,
  logger?: { info: (msg: string) => void }
): void {
  const handleShutdown = async (signal: string) => {
    logger?.info(`Received ${signal}, shutting down...`);
    await shutdownFn();
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}
