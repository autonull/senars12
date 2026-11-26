/**
 * `senars model list` — List available models.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { resolveLMSettings } from '@senars/lm';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'model list',
  description: 'List available models',
  usage: 'senars model list [options]',
  sections: [
    { lines: ['--provider <name>      Filter by provider (ollama, llamacpp, openai, anthropic, etc.)', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars model list',
    'senars model list --provider ollama --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const provider = flagHelpers.str(rawFlags, '--provider', '');
    const settings = resolveLMSettings();

    const output: Record<string, unknown> = {
      currentProvider: settings.provider,
      currentModel: settings.model,
      providers: {},
    };

    // Try to list models from various providers
    if (!provider || provider === 'ollama') {
      try {
        const response = await fetch(`${settings.ollamaHost ?? 'http://localhost:11434'}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          output.providers.ollama = data.models?.map((m: { name: string }) => m.name) ?? [];
        } else {
          output.providers.ollama = { error: 'unreachable' };
        }
      } catch {
        output.providers.ollama = { error: 'unreachable' };
      }
    }

    if (!provider || provider === 'openai-compatible') {
      try {
        const baseUrl = settings.baseUrl ?? 'http://localhost:11434/v1';
        const response = await fetch(`${baseUrl}/models`, {
          headers: settings.apiKeyEnv ? { Authorization: `Bearer ${process.env[settings.apiKeyEnv]}` } : {},
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const data = await response.json();
          output.providers[settings.provider ?? 'openai-compatible'] = data.data?.map((m: { id: string }) => m.id) ?? [];
        } else {
          output.providers[settings.provider ?? 'openai-compatible'] = { error: `HTTP ${response.status}` };
        }
      } catch (e) {
        output.providers[settings.provider ?? 'openai-compatible'] = { error: String(e) };
      }
    }

    // Embedded llama.cpp
    if (!provider || provider === 'llamacpp-embedded') {
      try {
        const { probeEmbeddedLlama } = await import('@senars/lm');
        const probe = await probeEmbeddedLlama();
        output.providers['llamacpp-embedded'] = probe.available ? [probe.detail] : { error: probe.detail };
      } catch (e) {
        output.providers['llamacpp-embedded'] = { error: String(e) };
      }
    }

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Current: ${output.currentProvider} / ${output.currentModel ?? 'default'}\n`);
      for (const [p, models] of Object.entries(output.providers)) {
        console.log(`--- ${p} ---`);
        if (Array.isArray(models)) {
          if (models.length === 0) console.log('  (no models found)');
          else for (const m of models) console.log(`  ${m}`);
        } else {
          console.log(`  ${JSON.stringify(models)}`);
        }
        console.log('');
      }
    }
  }, flags, 'model list');
});

export const modelListModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}