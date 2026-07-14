import { Effect } from 'effect';
import type {
  BackendConfig,
  BackendHealth,
  BackendInput,
  BackendResult,
  BackendSnapshot,
  Capability,
  CognitiveEvent,
  GraphDelta,
  GraphEdgeData,
  GraphNodeData,
  ReasoningBackend,
  ToolDefinition,
} from '@senars/core';
import { hashAtom } from '../core/hash.js';
import { createMeTTa, type MeTTaRuntime } from '../runtime/builder.js';
import type { MeTTaAtom, ExpressionAtom } from '../types/ast.js';
import { AtomKind, isExpression, isSymbol } from '../types/ast.js';
import { parseMeTTa } from '../parser/runtime.js';

const METTA_CAPABILITIES: ReadonlySet<Capability> = new Set([
  'pattern-match', 'rewrite', 'query', 'multi-space', 'skill-execution',
  'long-term-memory', 'episodic-memory',
]);

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
      const args = expr.args.map((a) => atomToString(a)).join(' ');
      return `(${atomToString(expr.operator)} ${args})`;
    }
    case AtomKind.Grounded:
      return `{${(atom as { readonly op: string }).op}}`;
    default:
      return String(atom);
  }
}

function extractAtomEdges(atom: MeTTaAtom, nodeId: string): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  if (isExpression(atom)) {
    const expr = atom as ExpressionAtom;
    for (const arg of expr.args) {
      const argId = `metta:${hashAtom(arg)}`;
      edges.push({
        source: nodeId,
        target: argId,
        type: 'metta:arg',
        weight: 1,
        directed: true,
      });
      edges.push(...extractAtomEdges(arg, argId));
    }
  }
  return edges;
}

function atomToNodeData(atom: MeTTaAtom): GraphNodeData {
  const id = `metta:${hashAtom(atom)}`;
  const atomStr = atomToString(atom);
  return {
    id,
    nodeType: 'metta:atom',
    atom: atomStr,
    space: 'default',
    priority: 0.9,
    confidence: 1.0,
    capabilities: ['pattern-match', 'query'],
  };
}

export class MettaBackend implements ReasoningBackend {
  readonly id = 'metta';
  readonly label = 'MeTTa Pattern Matcher';
  readonly capabilities = METTA_CAPABILITIES;

  #runtime: MeTTaRuntime | null = null;
  #initialized = false;

  async initialize(_config: BackendConfig): Promise<void> {
    this.#runtime = createMeTTa();
    this.#initialized = true;
  }

  async shutdown(): Promise<void> {
    this.#initialized = false;
    this.#runtime = null;
  }

  health(): BackendHealth {
    return {
      status: this.#initialized ? 'healthy' : 'degraded',
      detail: this.#initialized ? undefined : 'Not initialized',
    };
  }

  async reason(input: BackendInput): Promise<BackendResult> {
    if (!this.#runtime) {
      return {
        backendId: this.id,
        success: false,
        error: 'MeTTa backend not initialized',
        events: [],
      };
    }

    try {
      let program: MeTTaAtom;
      switch (input.type) {
        case 'skill': {
          const stripped = input.content.replace(/^skill:/, '').trim();
          program = parseMeTTa(stripped);
          break;
        }
        case 'chat':
          program = parseMeTTa(`(chat "${input.content.replace(/"/g, '\\"')}")`);
          break;
        case 'raw':
          program = parseMeTTa(input.content);
          break;
        default:
          return {
            backendId: this.id,
            success: false,
            error: `Unsupported input type: ${input.type}`,
            events: [],
          };
      }

      const result = await Effect.runPromise(this.#runtime.evaluate(program));
      return this.#resultToBackendResult(result, program, input.correlationId);
    } catch (e) {
      return {
        backendId: this.id,
        success: false,
        error: String(e),
        events: [],
      };
    }
  }

  #resultToBackendResult(
    result: MeTTaAtom,
    program: MeTTaAtom,
    correlationId: string,
  ): BackendResult {
    const progStr = atomToString(program);
    const resultStr = atomToString(result);
    const progNodeId = `metta:${hashAtom(program)}`;
    const resultNodeId = `metta:${hashAtom(result)}`;

    const nodes: GraphNodeData[] = [
      atomToNodeData(program),
      atomToNodeData(result),
    ];

    const edges: GraphEdgeData[] = [
      ...extractAtomEdges(program, progNodeId),
      ...extractAtomEdges(result, resultNodeId),
      {
        source: progNodeId,
        target: resultNodeId,
        type: 'metta:eval',
        weight: 1,
        directed: true,
      },
    ];

    const events: CognitiveEvent[] = [
      {
        engine: 'metta',
        type: 'derivation',
        term: `${progStr} => ${resultStr}`,
        confidence: 1,
        timestamp: Date.now(),
        correlationId,
      },
    ];

    return {
      backendId: this.id,
      success: true,
      output: { type: 'metta:atom', value: resultStr },
      events,
      graphDelta: { nodes, edges },
    };
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'metta-match',
        description: 'Pattern match in MeTTa space',
        schema: { pattern: 'string', space: { type: 'string', optional: true } },
        execute: async (args) => {
          if (!this.#runtime) throw new Error('Backend not initialized');
          const pattern = args.pattern as string;
          const program = parseMeTTa(`(match default ${pattern})`);
          const result = await Effect.runPromise(this.#runtime.evaluate(program));
          return atomToString(result);
        },
      },
      {
        name: 'metta-rewrite',
        description: 'Apply rewrite rule',
        schema: { rule: 'string', target: 'string', space: { type: 'string', optional: true } },
        execute: async (args) => {
          if (!this.#runtime) throw new Error('Backend not initialized');
          const rule = args.rule as string;
          const target = args.target as string;
          const program = parseMeTTa(`(rewrite default ${rule} ${target})`);
          const result = await Effect.runPromise(this.#runtime.evaluate(program));
          return atomToString(result);
        },
      },
      {
        name: 'metta-query',
        description: 'Query atoms in space',
        schema: { pattern: 'string', space: { type: 'string', optional: true } },
        execute: async (args) => {
          if (!this.#runtime) throw new Error('Backend not initialized');
          const pattern = args.pattern as string;
          const program = parseMeTTa(`(query default ${pattern})`);
          const result = await Effect.runPromise(this.#runtime.evaluate(program));
          return atomToString(result);
        },
      },
    ];
  }

  getSnapshot(): BackendSnapshot {
    return {
      backendId: this.id,
      capabilities: [...this.capabilities],
      state: {
        initialized: this.#initialized,
        runtimeExists: this.#runtime !== null,
      },
      timestamp: Date.now(),
    };
  }
}
