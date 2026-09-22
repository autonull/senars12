import { existsSync } from 'node:fs';
import { formatLMConfig, resolveLMConfig } from '../../nar/src/lm/env-config.js';
import { createLogger } from '../../nar/src/logger';

const logger = createLogger({ scope: 'config:check' });

/** Env vars that must be present for each provider to function (TODO20 C4). */
const REQUIRED_SECRETS: Partial<Record<string, string[]>> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
};

/** Providers that talk to remote endpoints and need *some* credential when so configured. */
const REMOTE_OPTIONAL_KEY = new Set(['openai-compatible']);

const checkProviderSecrets = (provider: string): string[] => {
  const required = REQUIRED_SECRETS[provider] ?? [];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length === 0 && REMOTE_OPTIONAL_KEY.has(provider)) {
    const hasKey =
      !!process.env.OPENAI_API_KEY || !!process.env.LM_API_KEY || !!process.env.LM_API_KEY_ENV;
    if (!hasKey) {
      console.log(
        `  ⚠ ${provider}: no API key set — fine for local daemons, required for hosted endpoints`
      );
    }
  }
  return missing;
};

const main = (): void => {
  let cfg: ReturnType<typeof resolveLMConfig>;
  try {
    cfg = resolveLMConfig();
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
  console.log('=== Resolved LM Configuration ===');
  console.log(formatLMConfig(cfg));
  console.log('=================================');

  // Secrets hygiene: verify required credentials for the enabled provider.
  const missing = checkProviderSecrets(cfg.provider);
  if (missing.length > 0) {
    console.error(`✗ Missing required secrets: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ Secrets present for provider "${cfg.provider}"`);

  // Spend cap visibility (hard cap enforced by lm/service/spend.ts SpendLedger).
  const cap = process.env.LM_MAX_SPEND_USD;
  console.log(`  Spend cap (LM_MAX_SPEND_USD): ${cap ?? 'unset (no cap)'}`);

  // Model file presence for the embedded provider.
  const embeddedModel = process.env.LM_LLAMACPP_MODEL;
  if (cfg.provider === 'llamacpp-embedded' && embeddedModel && !existsSync(embeddedModel)) {
    console.error(`✗ Embedded model file not found: ${embeddedModel}`);
    process.exit(1);
  }
};

main();
