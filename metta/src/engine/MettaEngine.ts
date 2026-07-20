import type {
  CognitiveStimulus,
  Context,
  Derivation,
  EngineId,
  ToolResult,
} from '@senars/core/engine';
import { BaseEngine } from '@senars/core/engine/base';
import { Effect } from 'effect';
import { parseMeTTa } from '../parser/runtime.js';
import { type MeTTaRuntime, createMeTTa } from '../runtime/builder.js';
import type { MeTTaAtom } from '../types/ast.js';
import { AtomKind, type ExpressionAtom } from '../types/ast.js';

function atomToString(atom: MeTTaAtom): string {
  switch (atom.kind) {
    case AtomKind.Symbol:
      return (atom as { readonly value: string }).value;
    case AtomKind.Variable:
      return `$${(atom as { readonly name: string }).name}`;
    case AtomKind.Number:
      return String((atom as { readonly value: number }).value);
    case AtomKind.String:
      return `"${(atom as { readonly value: string }).value}"`;
    case AtomKind.Expression: {
      const expr = atom as ExpressionAtom;
      const args = expr.args.map((a: MeTTaAtom) => atomToString(a)).join(' ');
      return `(${atomToString(expr.operator)} ${args})`;
    }
    case AtomKind.Grounded:
      return `{${(atom as { readonly op: string }).op}}`;
    default:
      return String(atom);
  }
}

export class MettaEngine extends BaseEngine {
  readonly id: EngineId = 'metta';
  readonly provides = new Set([
    'pattern-match',
    'rewrite',
    'query',
    'multi-space',
    'skill-execution',
  ]);

  #runtime: MeTTaRuntime | null = null;

  constructor(runtime?: MeTTaRuntime) {
    super();
    this.#runtime = runtime ?? null;
  }

  get runtime(): MeTTaRuntime | null {
    return this.#runtime;
  }

  protected async doInitialize(): Promise<void> {
    if (!this.#runtime) {
      this.#runtime = createMeTTa();
    }
  }

  protected async doShutdown(): Promise<void> {
    // Effect runtimes don't need explicit shutdown
  }

  async reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]> {
    if (!this.#runtime) return [];
    const text = stimulus.text;
    if (!text.startsWith('metta:')) return [];

    try {
      const program = text.startsWith('metta:') ? text.slice(6) : text;
      const parsed = parseMeTTa(program);
      const result = await Effect.runPromise(this.#runtime.evaluate(parsed));
      return [
        {
          term: atomToString(result),
          timestamp: Date.now(),
        },
      ];
    } catch {
      return [];
    }
  }

  async query(pattern: string): Promise<unknown[]> {
    if (!this.#runtime) return [];
    try {
      const program = parseMeTTa(pattern);
      const result = await Effect.runPromise(this.#runtime.evaluate(program));
      return [result];
    } catch {
      return [];
    }
  }

  protected override doAbsorb(result: ToolResult): void {
    // MeTTa can learn from tool results in future
  }

  async persist(): Promise<void> {
    // Persistence handled by Effect runtime if needed
  }

  async load(): Promise<void> {
    // Loading handled by Effect runtime if needed
  }
}
