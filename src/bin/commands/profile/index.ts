/**
 * `senars profile` — Profile management commands.
 */

import { runEntrypoint } from '../../lib/fatal-error';
import { standardSections, type HelpSection } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';

export const profileModule: CommandModule = createStubModule('profile', 'https://github.com/senars/senars/issues/XXX');

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(profileModule.main, { sections: profileModule.sections, version: '0.0.0' });
}