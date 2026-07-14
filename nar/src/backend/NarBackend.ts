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
import type { Agent } from '../agent/types.js';

const NAR_CAPABILITIES: ReadonlySet<Capability> = new Set([
  'inheritance', 'implication', 'prediction', 'retrospection',
  'conjunction', 'disjunction', 'negation', 'abduction', 'deduction',
  'induction', 'analogy', 'truth-revision',
  'drive-management', 'goal-management',
  'episodic-memory', 'working-memory',
  'self-reasoning', 'autonomy-loop', 'tool-use', 'llm-completion',
]);

export class NarBackend implements ReasoningBackend {
  readonly id = 'nar';
  readonly label = 'NAR Symbolic Reasoner';
  readonly capabilities = NAR_CAPABILITIES;

  #agent: Agent;
  #eventBuffer: CognitiveEvent[] = [];
  #initialized = false;
  #externalTools: ToolDefinition[] = [];

  constructor(agent: Agent) {
    this.#agent = agent;
  }

  setExternalTools(tools: ToolDefinition[]): void {
    this.#externalTools = tools;
    this.#injectToolsIntoAgent();
  }

  #injectToolsIntoAgent(): void {
    const converted = this.#convertToolDefinitions(this.#externalTools);
    // The AI SDK tool format is a Record<string, Tool>, which ToolBuilder.extToolOpts accepts
    // We directly update the agent's extToolOpts if the agent supports it
    const agentImpl = this.#agent as { setExternalToolOpts?: (tools: Record<string, unknown>) => void };
    agentImpl.setExternalToolOpts?.(converted);
  }

  #convertToolDefinitions(tools: ToolDefinition[]): Record<string, unknown> {
    // Convert to simplified tool format - just a Record<string, { execute }>
    // ToolBuilder accepts this for extToolOpts
    const result: Record<string, unknown> = {};
    for (const t of tools) {
      result[t.name] = {
        description: t.description,
        execute: t.execute,
      };
    }
    return result;
  }

  async initialize(_config: BackendConfig): Promise<void> {
    this.#agent.on('*', (event: CognitiveEvent) => {
      this.#eventBuffer.push(event);
    });
    this.#agent.start();
    this.#initialized = true;
  }

  async shutdown(): Promise<void> {
    this.#initialized = false;
    this.#agent.stop();
  }

  health(): BackendHealth {
    const h = this.#agent.health();
    return { status: h.status };
  }

  async reason(input: BackendInput): Promise<BackendResult> {
    const startIdx = this.#eventBuffer.length;

    try {
      switch (input.type) {
        case 'belief':
        case 'goal':
        case 'question':
        case 'raw':
          await this.#agent.believe(input.content);
          break;
        case 'chat':
          await this.#agent.chat(input.content);
          break;
        case 'skill':
          return {
            backendId: this.id,
            success: false,
            error: 'NAR backend does not support skill execution',
            events: [],
          };
      }

      const newEvents = this.#eventBuffer.slice(startIdx);
      return {
        backendId: this.id,
        success: true,
        events: newEvents,
        graphDelta: this.#eventsToGraphDelta(newEvents, input.correlationId),
      };
    } catch (e) {
      return {
        backendId: this.id,
        success: false,
        error: String(e),
        events: this.#eventBuffer.slice(startIdx),
      };
    }
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'nar-query',
        description: 'Query NAR beliefs matching a term pattern',
        schema: { term: 'string' },
        execute: async (args) => {
          const term = args.term as string;
          return this.#agent.getNAR()?.getBeliefs().filter((b) =>
            b.term.toString().includes(term)
          ).map((b) => ({
            term: b.term.toString(),
            truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : null,
          })) ?? [];
        },
      },
      {
        name: 'nar-explain',
        description: 'Explain the evidence for a belief term',
        schema: { term: 'string' },
        execute: async (args) => this.#agent.explainBelief(args.term as string),
      },
      {
        name: 'nar-trace',
        description: 'Trace rule application for a term',
        schema: { ruleId: 'string', term: 'string' },
        execute: async (args) =>
          this.#agent.traceRule(args.ruleId as string, args.term as string),
      },
    ];
  }

  getSnapshot(): BackendSnapshot {
    const nar = this.#agent.getNAR();
    const stats = nar?.getStatistics();
    return {
      backendId: this.id,
      capabilities: [...this.capabilities],
      state: {
        beliefs: nar?.getBeliefs().length ?? 0,
        totalConcepts: stats?.totalConcepts ?? 0,
      },
      timestamp: Date.now(),
    };
  }

  // Parse Narsese relations: <subject --> predicate>
  #parseRelations(input: string): Array<{ subject: string; predicate: string; type: string }> {
    const links: Array<{ subject: string; predicate: string; type: string }> = [];
    if (!input) return links;
    const COPULA_RE = /[(<](.+?)\s*(-->|<->|\{--|--]|{-]|=->)\s*(.+?)[>)]/g;
    for (const stmt of input.split(';')) {
      for (const m of stmt.matchAll(COPULA_RE)) {
        const cop = m[2] ?? '';
        const type = cop === '<->' ? 'similarity' : cop === '{--' ? 'instance' : 'inheritance';
        links.push({ subject: (m[1] ?? '').trim(), predicate: (m[3] ?? '').trim(), type });
      }
    }
    return links;
  }

  #eventsToGraphDelta(events: CognitiveEvent[], _correlationId: string): GraphDelta | undefined {
    const nodes: GraphNodeData[] = [];
    const seenNodes = new Set<string>();
    const edges: GraphEdgeData[] = [];
    const seenEdges = new Set<string>();

    const addNode = (id: string, nodeType: string, term: string, priority: number, confidence: number, caps: string[]): void => {
      if (seenNodes.has(id)) return;
      seenNodes.add(id);
      nodes.push({
        id,
        nodeType: nodeType as 'nar:concept',
        term,
        priority,
        confidence,
        capabilities: caps,
      });
    };

    const addEdge = (source: string, target: string, type: string, weight: number): void => {
      const key = `${source}->${target}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edges.push({ source, target, type, weight, directed: true });
    };

    for (const event of events) {
      switch (event.type) {
        case 'derivation': {
          const rels = this.#parseRelations(event.term);
          if (rels.length > 0) {
            for (const rel of rels) {
              addNode(rel.subject, 'nar:concept', rel.subject, 0.5, event.confidence, ['inheritance', 'truth-revision']);
              addNode(rel.predicate, 'nar:concept', rel.predicate, 0.5, event.confidence, ['inheritance', 'truth-revision']);
              addEdge(rel.subject, rel.predicate, rel.type, 0.6);
            }
          } else {
            const nodeId = `nar:${this.#sanitizeId(event.term)}`;
            addNode(nodeId, 'nar:concept', event.term, 0.5, event.confidence, ['inheritance', 'truth-revision']);
          }
          break;
        }
        case 'concept:activated': {
          addNode(event.term, 'nar:concept', event.term, event.priority ?? 0.5, 0.5, ['working-memory']);
          break;
        }
      }
    }

    if (nodes.length === 0 && edges.length === 0) return undefined;

    return { nodes, edges };
  }

  #sanitizeId(term: string): string {
    return term.replace(/[^a-zA-Z0-9_:.-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
}
