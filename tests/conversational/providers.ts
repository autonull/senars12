import type { ZodSchema } from 'zod';
import { LMService, createMockLMService, createSeNARSRegistry } from '../../nar/src/lm';

export type LMProvider = 'transformers' | 'ollama' | 'mock';

export function resolveProvider(): LMProvider {
  const env = (process.env.LM_PROVIDER ?? 'mock').toLowerCase();
  if (env === 'ollama' || env === 'transformers') return env;
  return 'mock';
}

const PATTERNS: Array<[RegExp, string]> = [
  [
    /harm|forbidden|blocked|violation|constitution/i,
    'Constitution check blocked: this action is forbidden.',
  ],
  [/help people|help human|support/i, 'Helping people is good! I support that.'],
  [/explain why.*robin/i, 'A robin is a bird. Since all birds are animals, a robin is an animal.'],
  [
    /trace.*rule.*bird|trace.*lm-belief/i,
    'Tracing lm-belief-revision for bird concept: belief was revised with confidence 0.9.',
  ],
  [
    /explain.*goal.*fly|goal.*learn.*fly/i,
    'The goal of learning to fly involves acquiring flight skills for survival.',
  ],
  [/15 \* ?3|calculate.*15.*3/i, 'The result is 45.'],
  [/5\+5|what.*5\+5/i, 'The answer is 10.'],
  [/7\+7|what.*7\+7/i, 'The answer is 14.'],
  [/2\+2|what.*2\+2/i, 'The answer is 4.'],
  [/penguin/i, 'Penguins are flightless birds that cannot fly.'],
  [/sparrow/i, 'A sparrow is a bird that can fly.'],
  [/robin/i, 'A robin is a bird. Since all birds are animals, a robin is an animal.'],
  [/cat.*animal|all.*cat/i, 'Yes, cats are animals. That belief has been recorded.'],
  [/remember.*color|favorite.*color/i, 'I remember your favorite color is blue.'],
  [/hello|^hi$/i, 'Hello! How can I help you today?'],
  [/goodbye|bye$/i, 'Goodbye! Have a nice day!'],
  [/calculate/i, 'Let me calculate that for you.'],
  [
    /decompose.*goal|subgoal/i,
    'I will decompose this goal into subgoals: design, gather materials, build.',
  ],
  [/contradict|conflict/i, 'I notice a contradiction that needs resolution.'],
  [/tool|search/i, 'Let me use a tool to find that information.'],
  [/derive|conclusion/i, 'I derived a new belief from existing knowledge.'],
  [/curious.*quantum|quantum/i, 'I am curious about quantum mechanics too!'],
  [/urgent|need help/i, 'This is urgent! I will prioritize this immediately.'],
  [
    /current.*drive|what.*drive/i,
    'Your current drives are: curiosity level 0.6, urgency level 0.3.',
  ],
  [/fly|can.*fly/i, 'Birds can typically fly, but flightless birds like penguins cannot.'],
  [/bird/i, 'Birds are animals with feathers and wings.'],
  [/animal|is.*cat/i, 'Yes, cats are animals and they are living things.'],
  [/goal|i want/i, 'I understand your goal. Let me work on that.'],
  [/explain|why/i, 'Let me explain this through logical inference.'],
  [
    /what.*step|how.*build/i,
    'The steps involve: gather materials, design plan, and build the structure.',
  ],
  [/trace|rule/i, 'Tracing the rule application for this concept.'],
];

function smartMockResponse(text: string): string {
  for (const [re, response] of PATTERNS) {
    if (re.test(text)) return response;
  }
  return `I understand. Here is my response regarding "${text.slice(0, 60)}".`;
}

export function resolveTestLMService(): LMService {
  const provider = resolveProvider();
  if (provider === 'mock') {
    return createMockLMService({
      generateTextFn: smartMockResponse,
      generateObjectFn: <T>(_p: string, schema: ZodSchema<T>) => ({}) as T,
    });
  }
  const registry = createSeNARSRegistry();
  return new LMService(registry);
}

export function describeProvider(): string {
  const provider = resolveProvider();
  const model = process.env.LM_MODEL ?? process.env.OLLAMA_MODEL ?? 'default';
  return `${provider}:${model}`;
}
