import { formatLMConfig, resolveLMConfig } from '../../nar/src/lm/env-config.js';
import { createLogger } from '../../nar/src/logger';

const logger = createLogger({ scope: 'config:check' });

const main = (): void => {
  let cfg;
  try {
    cfg = resolveLMConfig();
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
  console.log('=== Resolved LM Configuration ===');
  console.log(formatLMConfig(cfg));
  console.log('=================================');
};

main();
