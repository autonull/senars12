/**
 * `senars wasm-bundle` — Generate WASM bundle (stub).
 */

import { runEntrypoint } from '../lib/fatal-error';
import { standardSections, type HelpSection } from '../lib/cli-utils';
import type { CommandModule } from '../lib/cli';
import { createStubModule } from '../lib/command-base';

export const sections: HelpSection[] = [
  standardSections.usage('senars wasm-bundle', 'Generate WASM bundle'),
  {
    title: 'Status',
    lines: ['⚠️  Command not yet implemented'],
  },
];

export const wasmBundleModule: CommandModule = createStubModule('wasm-bundle', 'https://github.com/senars/senars/issues/XXX');

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../lib/cli-utils');
  runCLI(wasmBundleModule.main, { sections: wasmBundleModule.sections, version: '0.0.0' });
}