import { createMockLMService } from '@senars/nar';
import { createConfiguredLMRules } from '@senars/nar/lm';
import { describe, expect, it } from 'vitest';
import { appConfigSchema, lmRuleSchema } from '../../src/config/schema.js';

interface LMRuleShape {
  id: string;
  enabled: boolean;
}

describe('appConfigSchema: previously stripped blocks', () => {
  it('parses memory/inference/backends/irc/production/agent blocks', () => {
    const config = appConfigSchema.parse({
      configVersion: '1.0',
      agent: { name: 'senars', persona: 'curious assistant' },
      backends: { nar: { enabled: true }, metta: { enabled: false } },
      memory: { maxConcepts: 200, derivationDepth: 5 },
      inference: { maxDerivationDepth: 10, maxDerivationsPerStep: 100, cpuThrottleMs: 10 },
      production: { provider: 'openai-compatible', model: 'gpt-x', apiKeyEnv: 'MY_KEY' },
      irc: { server: 'irc.libera.chat', nick: 'bot', channels: ['#nars'] },
      bot: { lmRules: { enabled: true, rules: [{ id: 'lm-narsese-translation' }] } },
    });
    expect(config.memory.maxConcepts).toBe(200);
    expect(config.inference.cpuThrottleMs).toBe(10);
    expect(config.backends.metta.enabled).toBe(false);
    expect(config.backends.nar.enabled).toBe(true);
    expect(config.irc?.nick).toBe('bot');
    expect(config.production?.model).toBe('gpt-x');
    expect(config.agent.name).toBe('senars');
    expect(config.bot.lmRules.rules).toHaveLength(1);
  });

  it('maps agent identity onto the bot profile', () => {
    const config = appConfigSchema.parse({ agent: { name: 'senars', persona: 'curious' } });
    expect(config.profile.name).toBe('senars');
    expect(config.profile.personality).toBe('curious');
  });

  it('defaults memory/inference to empty so NAR defaults apply', () => {
    const config = appConfigSchema.parse({});
    expect(config.memory.maxConcepts).toBeUndefined();
    expect(config.inference.maxDerivationDepth).toBeUndefined();
  });

  it('validates lm rule entries and rejects malformed ones', () => {
    expect(lmRuleSchema.safeParse({ id: 'lm-narsese-translation' }).success).toBe(true);
    expect(lmRuleSchema.safeParse({}).success).toBe(false);
    expect(lmRuleSchema.safeParse({ id: 'x', priority: 'high' }).success).toBe(false);
  });
});

describe('createConfiguredLMRules', () => {
  it('builds preset rules by id and reports unknown ids', () => {
    const lm = createMockLMService();
    const { rules, unknownIds } = createConfiguredLMRules(lm, [
      { id: 'lm-narsese-translation' },
      { id: 'custom-thing', prompt: 'Reason about {{primaryTerm}}' },
      { id: 'lm-explanation-generation', enabled: false },
    ]);
    expect(unknownIds).toEqual(['custom-thing']);
    expect(rules).toHaveLength(3);
    const ids = rules.map((r) => (r as unknown as LMRuleShape).id);
    expect(ids).toContain('lm-narsese-translation');
    expect(ids).toContain('lm-explanation-generation');
    const disabled = rules.find((r) => (r as unknown as LMRuleShape).enabled === false);
    expect(disabled?.id).toBe('lm-explanation-generation');
  });
});
