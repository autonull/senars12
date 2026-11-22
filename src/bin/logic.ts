#!/usr/bin/env tsx
/**
 * `senars logic` — the stand-alone logic tool.
 *
 * Five commands over the deterministic axiomatic core:
 *
 *   senars logic prove "<program>" "<goal>"     # SLD proof + re-checkable certificate
 *   senars logic model '<formula-json>'        # finite model of the formula
 *   senars logic counterexample '<formula-json>' # model of the negation
 *   senars logic check '<certificate-json>'    # re-check a certificate
 *   senars logic convert '<input>' --to narsese|json|prolog|tptp
 *
 * Exit code is 0 for a positive result, 1 otherwise. Output is JSON, so the
 * command is usable from a script and from any MCP client.
 */

import { readFileSync } from 'node:fs';
import type { Formula } from '../logics/axiomatic/ast';
import { parseFlags } from '../util/cli';
import { check, convert, counterexample, model, prove, type ConvertTarget } from '../logic/commands';
import type { CommandResult } from '../logic/verdict';

const flags = parseFlags();
const [command, first, ...remaining] = flags.positional;
const rest = remaining.join(' ');

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
