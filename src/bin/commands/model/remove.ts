/**
 * `senars model remove` — Remove a model.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'model:remove' });

export const sections: HelpSection[] = [
  standardSections.usage('senars model remove', 'Remove a model'),
  {
    title: 'Arguments',
    lines: [
      '<model>                Model identifier to remove',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--provider <name>      Provider: ollama|llamacpp (default: ollama)',
      '--json                 Output machine-readable JSON',
      '--yes                  Skip confirmation prompt',
    ],
  },
  standardSections.examples([
    'senars model remove llama3.2',
    'senars model remove qwen2.5:7b --provider ollama --yes',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const model = positional[0];
  const provider = argv.str('--provider', 'ollama');
  const yes = argv.has('--yes');

  if (!model) {
    console.error('Error: <model> argument required');
    process.exit(1);
  }

  if (!yes && !jsonOutput) {
    // In a real CLI, we'd prompt for confirmation
    // For now, just warn
    console.warn(`Warning: This will remove ${model} from ${provider}. Use --yes to confirm.`);
    process.exit(1);
  }

  let result: { success: boolean; model: string; provider: string; error?: string };

  if (provider === 'ollama') {
    try {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
      const response = await fetch(`${host}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        result = { success: true, model, provider: 'ollama' };
      } else {
        const err = await response.text();
        result = { success: false, model, provider: 'ollama', error: err };
      }
    } catch (e) {
      result = { success: false, model, provider: 'ollama', error: String(e) };
    }
  } else if (provider === 'llamacpp') {
    result = { success: false, model, provider: 'llamacpp', error: 'llamacpp model remove not yet implemented. Delete the model file manually.' };
  } else {
    result = { success: false, model, provider, error: `Unknown provider: ${provider}` };
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.success) {
    console.log(`✓ Removed ${model} from ${provider}`);
  } else {
    console.error(`✗ Failed to remove ${model}: ${result.error}`);
    process.exit(1);
  }
}

export const modelRemoveModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}