import { Effect } from 'effect';
import type { EventLog } from '@senars/core/eventlog';
import type { ConfigView } from '@senars/core/config';
import type { CognitiveEvent } from '@senars/core/events';
import { EventBackend } from '@senars/core/event-backend';
import type { BackendManifest, ToolDefinition } from '@senars/core/backend';
import type { ToolProvider, ToolResult } from '@senars/core/tool-provider';
import { createMeTTa, type MeTTaRuntime } from '../runtime/builder.js';
import type { MeTTaAtom, ExpressionAtom } from '../types/ast.js';
import { AtomKind, isExpression } from '../types/ast.js';
import { parseMeTTa } from '../parser/runtime.js';
import { Capability as Cap } from '@senars/core/capability';

const METTA_CAPABILITIES: ReadonlySet<Cap> = new Set([
  Cap.PatternMatch, Cap.Rewrite, Cap.Query, Cap.MultiSpace, Cap.SkillExecution,
  Cap.LongTermMemory, Cap.EpisodicMemory,
]);

function atomToString(atom: MeTTaAtom): string {
  switch (atom.kind) {
    case AtomKind.Symbol: return (atom as { readonly value: string }).value;
    case AtomKind.Variable: return `$${(atom as { readonly name: string }).name}`;
    case AtomKind.Number: return String((atom as { readonly value: number }).value);
    case AtomKind.String: return `"${(atom as { readonly value: string }).value}"`;
    case AtomKind.Expression: {
      const expr = atom as ExpressionAtom;
      const args = expr.args.map((a) => atomToString(a)).join(' ');
      return `(${atomToString(expr.operator)} ${args})`;
    }
    case AtomKind.Grounded: return `{${(atom as { readonly op: string }).op}}`;
    default: return String(atom);
  }
}

export class MettaBackend extends EventBackend implements ToolProvider {
  readonly id = 'metta';
  readonly manifest: BackendManifest = {
    id: 'metta',
    provides: METTA_CAPABILITIES,
    requires: new Set(),
    configSchema: {},
    eventTypes: new Set(['atom.derived', 'atom.retracted', 'skill.executed', 'query.result']),
    handles: new Set(['input.user', 'config.set']),
  };

  #runtime: MeTTaRuntime | null = null;

  override async initialize(log: EventLog, _config: ConfigView): Promise<void> {
    this.#runtime = createMeTTa();
    await super.initialize(log, _config);
  }

  override async shutdown(): Promise<void> {
    this.#runtime = null;
  }

  protected override async process(event: CognitiveEvent): Promise<void> {
    if (!this.#runtime) return;
    switch (event.type) {
      case 'input.user': {
        const text = (event.payload as { text: string }).text;
        if (!text.startsWith('metta:')) break;
        const program = parseMeTTa(text.slice(6));
        const result = await Effect.runPromise(this.#runtime.evaluate(program));
        await this.log.append({
          type: 'atom.derived',
          payload: { atom: atomToString(result), space: 'default' },
          correlationId: event.correlationId,
          causationId: event.id,
        });
        break;
      }
      case 'config.set': break;
    }
  }

  async executeTool(name: string, args: Record<string, unknown>, _correlationId?: string): Promise<ToolResult> {
    if (!this.#runtime) return { success: false, content: null, error: 'MettaBackend not initialized' };
    try {
      switch (name) {
        case 'metta-match':
        case 'metta-query': {
          const pattern = String(args.pattern ?? '');
          const program = parseMeTTa(pattern);
          const result = await Effect.runPromise(this.#runtime.evaluate(program));
          return { success: true, content: atomToString(result) };
        }
        case 'metta-rewrite': {
          const rule = String(args.rule ?? '');
          const target = String(args.target ?? '');
          const program = parseMeTTa(`(rewrite ${rule} ${target})`);
          const result = await Effect.runPromise(this.#runtime.evaluate(program));
          return { success: true, content: atomToString(result) };
        }
        default:
          return { success: false, content: null, error: `Unknown tool: ${name}` };
      }
    } catch (e) {
      return { success: false, content: null, error: String(e) };
    }
  }

  getTools(): ToolDefinition[] {
    return [
      { name: 'metta-match', description: 'Pattern match in MeTTa space', schema: { pattern: 'string', space: { type: 'string', optional: true } }, backendId: 'metta' },
      { name: 'metta-rewrite', description: 'Apply rewrite rule', schema: { rule: 'string', target: 'string', space: { type: 'string', optional: true } }, backendId: 'metta' },
      { name: 'metta-query', description: 'Query atoms in space', schema: { pattern: 'string', space: { type: 'string', optional: true } }, backendId: 'metta' },
    ];
  }
}