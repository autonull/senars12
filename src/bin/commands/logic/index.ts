/**
 * `senars logic` — Stand-alone logic tool (wraps existing logic.ts)
 *
 * Five commands over the deterministic axiomatic core:
 *   senars logic prove "<program>" "<goal>"     # SLD proof + re-checkable certificate
 *   senars logic model '<formula-json>'        # finite model of the formula
 *   senars logic counterexample '<formula-json>' # model of the negation
 *   senars logic check '<certificate-json>'    # re-check a certificate
 *   senars logic convert '<input>' --to narsese|json|prolog|tptp
 *
 * Exit code is 0 for a positive result, 1 otherwise. Output is JSON.
 */

import { readFileSync } from 'node:fs';
import { parseFlags } from '../../../util/cli';
import { check, convert, counterexample, model, prove, type ConvertTarget } from '../../../logic/commands';
import type { CommandResult } from '../../../logic/verdict';
import type { Formula } from '../../../logics/axiomatic/ast';
import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { runEntrypoint } from '../../lib/fatal-error';
import type { CommandModule } from '../../lib/cli';

export const sections: HelpSection[] = [
  standardSections.usage('senars logic', 'Stand-alone logic tool over deterministic axiomatic core'),
  {
    title: 'Commands',
    lines: [
      'prove "<program>" "<goal>"        SLD proof + re-checkable certificate',
      'model \'<formula-json>\'           Finite model of the formula',
      'counterexample \'<formula-json>\'  Model of the negation',
      'check \'<certificate-json>\'       Re-check a certificate',
      'convert \'<input>\' --to <fmt>     Convert between formats',
    ],
  },
  {
    title: 'Convert Formats',
    lines: [
      '--to narsese    Convert to Narsese (default)',
      '--to json       Convert to JSON AST',
      '--to prolog     Convert to Prolog',
      '--to tptp       Convert to TPTP',
    ],
  },
  standardSections.examples([
    'senars logic prove "<a,b>" "<a>"',
    'senars logic model \'{"type":"atom","name":"p"}\'',
    'senars logic counterexample \'{"type":"and","args":[{"type":"atom","name":"p"},{"type":"atom","name":"q"}]}\'',
    'senars logic check \'{"ok":true,"certificate":"..."}\'',
    'senars logic convert "<a,b>" --to json',
    'senars logic convert \'{"type":"atom","name":"p"}\' --to narsese',
  ]),
];

const emit = (result: CommandResult): void => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
};

const formulaOf = (json: string | undefined): Formula => {
  try {
    return JSON.parse(json ?? '') as Formula;
  } catch (error) {
    console.error(`invalid formula JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
};

const certificateOf = (input: string | undefined): string => {
  if (!input) process.exit(2);
  if (input.trim().startsWith('{')) return input;
  return readFileSync(input, 'utf8');
};

const settle = (result: CommandResult): void => {
  emit(result);
};

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const [command, first, ...remaining] = positional;
  const rest = remaining.join(' ');

  switch (command) {
    case 'prove':
      if (!first || !rest) {
        console.error('usage: senars logic prove "<program>" "<goal>"');
        process.exit(2);
      }
      settle(prove(first, rest));
      break;
    case 'model':
      settle(model(formulaOf(first)));
      break;
    case 'counterexample':
      settle(counterexample(formulaOf(first)));
      break;
    case 'check':
      settle(check(certificateOf(first)));
      break;
    case 'convert':
      settle(convert(first ?? '', flags.str('--to', 'json') as ConvertTarget));
      break;
    default:
      console.error('usage: senars logic <prove|model|counterexample|check|convert> ...');
      process.exit(2);
  }
}

export const logicModule: CommandModule = {
  main,
  sections,
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}