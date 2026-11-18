/**
 * The MeTTa engine as a `MettaPort` — the whole of the MeTTa surface `nar`
 * consumes, behind the interface that lets `nar` sit below `metta` in the
 * layering. One runtime, one parser, three methods.
 */
import type { MettaPort } from '@senars/core/metta-port';
import { Effect } from 'effect';
import { parseMeTTa } from '../parser/runtime.js';
import { createMeTTa, type MeTTaRuntime } from '../runtime/builder.js';
import { MettaCommandParser } from './MettaCommandParser.js';

export function createMettaPort(runtime: MeTTaRuntime = createMeTTa()): MettaPort {
  const commandParser = new MettaCommandParser();

  return {
    parseCommands: (text) => commandParser.parse(text),

    query: async (expression) => {
      try {
        const result = await Effect.runPromise(runtime.evaluate(parseMeTTa(expression)));
        return [result];
      } catch {
        return [];
      }
    },

    loadProgram: async (program) => {
      await Effect.runPromise(runtime.evaluate(parseMeTTa(program)));
      return program;
    },
  };
}
