/**
 * `senars model pull` — Pull/download a model.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'model:pull' });

export const sections: HelpSection[] = [
  standardSections.usage('senars model pull', 'Pull/download a model'),
  {
    title: 'Arguments',
    lines: [
      '<model>                Model identifier (e.g., llama3.2, qwen2.5:7b)',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--provider <name>      Provider: ollama|llamacpp (default: ollama)',
      '--quantization <q>     Quantization for llama.cpp (e.g., Q4_K_M, Q8_0)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars model pull llama3.2',
    'senars model pull qwen2.5:7b --provider ollama',
    'senars model pull Llama-3.2-3B-Instruct --provider llamacpp --quantization Q4_K_M',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const model = positional[0];
  const provider = argv.str('--provider', 'ollama');
  const quantization = argv.str('--quantization');

  if (!model) {
    console.error('Error: <model> argument required');
    process.exit(1);
  }

  let result: { success: boolean; model: string; provider: string; path?: string; error?: string };

  if (provider === 'ollama') {
    try {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
      const response = await fetch(`${host}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false }),
        signal: AbortSignal.timeout(300000), // 5 min timeout
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
    result = { success: false, model, provider: 'llamacpp', error: 'llamacpp model pull not yet implemented. Use huggingface-cli or download manually.' };
  } else {
    result = { success: false, model, provider, error: `Unknown provider: ${provider}` };
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.success) {
    console.log(`✓ Pulled ${model} from ${provider}`);
  } else {
    console.error(`✗ Failed to pull ${model}: ${result.error}`);
    process.exit(1);
  }
}

export const modelPullModule: CommandModule = {
  main,
  sections,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}