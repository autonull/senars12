/**
 * `senars wasm-bundle` — Generate WASM bundle (stub).
 */

import type { CommonFlags, HelpSection } from '../lib/cli-utils';
import { runCLI, standardSections } from '../lib/cli-utils';
import { runEntrypoint } from '../lib/fatal-error';
import type { CommandModule } from '../lib/cli';

export const sections: HelpSection[] = [
  standardSections.usage('senars wasm-bundle', 'Generate WASM bundle'),
  {
    title: 'Status',
    lines: ['⚠️  Command not yet implemented'],
  },
];

export async function main(flags: CommonFlags): Promise<void> {
  console.error('⚠️  Command not yet implemented: wasm-bundle');
  console.error('   Track progress: https://github.com/senars/senars/issues/XXX');
  process.exit(1);
}

export const wasmBundleModule: CommandModule = { main, sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}