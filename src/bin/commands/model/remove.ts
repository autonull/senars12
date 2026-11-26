/**
 * `senars model remove` — Remove a model.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'model remove',
  description: 'Remove a model',
  usage: 'senars model remove <model> [options]',
  sections: [
    { lines: ['<model>                Model identifier to remove'] },
    { lines: ['--provider <name>      Provider: ollama|llamacpp (default: ollama)', '--json                 Output machine-readable JSON', '--yes                  Skip confirmation prompt'] },
  ],
  examples: [
    'senars model remove llama3.2',
    'senars model remove qwen2.5:7b --provider ollama --yes',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const model = positional[0];
    const provider = flagHelpers.str(rawFlags, '--provider', 'ollama');
    const yes = flagHelpers.has(rawFlags, '--yes');

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
  }, flags, 'model remove');
});

export const modelRemoveModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}