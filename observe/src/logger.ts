import { createLogger } from '@senars/util/logger';

const loggers = new Map<string, ReturnType<typeof createLogger>>();

export function getLogger(scope: string): ReturnType<typeof createLogger> {
  let logger = loggers.get(scope);
  if (!logger) {
    logger = createLogger({ scope });
    loggers.set(scope, logger);
  }
  return logger;
}