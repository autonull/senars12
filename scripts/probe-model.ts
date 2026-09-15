import { createSeNARSRegistry } from '../nar/src/lm/providers.ts';
import { createLMService } from '../nar/src/lm/lm-service.ts';
import { NLUnderstandingService } from '../nar/src/nl/understanding.ts';
import { TranslationCache } from '../nar/src/nl/cache.ts';

process.env.LM_PROVIDER = 'openai-compatible';
process.env.LM_BASE_URL = 'http://localhost:8080/v1';
process.env.LM_API_KEY = 'dummy';
process.env.LM_MODEL = 'Qwen3.5-4B-Uncensored-HauhauCS-Aggressive-Q4_K_M';

const lm = createLMService();
console.log('provider:', lm.provider, 'model:', lm.model, 'hasModel:', lm.hasModel());

const cache = new TranslationCache({ maxSize: 100 });
const understanding = new NLUnderstandingService(lm, cache, { structuredOnly: true });

const t0 = Date.now();
const batch = await understanding.understandCandidates(
  'The server will crash unless the backup generator kicks in. The backup generator did not kick in.'
);
console.log('Time:', (Date.now() - t0) / 1000 + 's');
console.log('Batch:', JSON.stringify(batch, null, 1)?.slice(0, 1500));
process.exit(0);