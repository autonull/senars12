import { generateText } from 'ai';

export interface ToolCall {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
}

export interface ToolError {
  toolCallId: string;
  toolName: string;
  message: string;
}

export interface ReasoningArtifact {
  type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ComposedRequest {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | unknown[];
    timestamp?: number;
  }>;
  tools: Record<string, unknown>;
  ctxHash: string;
  snapshot: unknown;
  budget: {
    systemTokens: number;
    historyTokens: number;
    snapshotTokens: number;
    total: number;
    maxTokens: number;
  };
}

export type ModelEvent =
  | { kind: 'text-delta'; text: string }
  | { kind: 'tool-call'; call: ToolCall }
  | { kind: 'tool-result'; call: ToolCall; result: unknown }
  | { kind: 'tool-error'; call: ToolCall; error: string }
  | { kind: 'finish'; text: string; toolCalls: ToolCall[] };

export interface ModelRunResult {
  text: string;
  toolCalls: ToolCall[];
  artifacts: ReasoningArtifact[];
  errors: ToolError[];
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[] }>;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface ModelProvider {
  readonly available: boolean;
  getModel(tier?: string): unknown;
}

export interface ModelRunnerDeps {
  modelProvider?: ModelProvider;
  maxLoops?: number;
  maxOutputTokens?: number;
  maxToolResultEntries?: number;
  maxToolResultChars?: number;
}

const DEFAULT_MAX_TOOL_RESULT_ENTRIES = 20;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 8_000;

export class ModelRunner {
  private readonly modelProvider?: ModelProvider;
  private readonly maxLoops: number;
  private readonly maxOutputTokens: number;
  private readonly maxToolResultEntries: number;
  private readonly maxToolResultChars: number;

  constructor(deps: ModelRunnerDeps) {
    this.modelProvider = deps.modelProvider;
    this.maxLoops = deps.maxLoops ?? 5;
    this.maxOutputTokens = deps.maxOutputTokens ?? 2048;
    this.maxToolResultEntries = deps.maxToolResultEntries ?? DEFAULT_MAX_TOOL_RESULT_ENTRIES;
    this.maxToolResultChars = deps.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS;
  }

  hasModel(): boolean {
    return !!this.modelProvider?.available;
  }

  async *run(
    composed: ComposedRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ModelEvent, ModelRunResult> {
    if (!this.modelProvider || !this.modelProvider.available) {
      return {
        text: '',
        toolCalls: [],
        artifacts: [],
        errors: [],
        messages: composed.messages,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const model = this.modelProvider.getModel('fast') as any;
    if (!model) {
      return {
        text: 'No model available',
        toolCalls: [],
        artifacts: [],
        errors: [],
        messages: composed.messages,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const allCalls: ToolCall[] = [];
    const allArtifacts: ReasoningArtifact[] = [];
    const allErrors: ToolError[] = [];
    let text = '';
    let totalInput = 0;
    let totalOutput = 0;

    const messages = this.toMessages(composed);

    for (let loop = 0; loop < this.maxLoops; loop++) {
      if (signal?.aborted) break;

      try {
        const result = await generateText({
          model,
          messages,
          instructions: composed.system || undefined,
          allowSystemInMessages: true,
          tools: Object.keys(composed.tools).length > 0 ? composed.tools : undefined,
          maxOutputTokens: this.maxOutputTokens,
          abortSignal: signal,
        } as any);

        text = result.text;
        if (result.usage) {
          totalInput += result.usage.inputTokens ?? 0;
          totalOutput += result.usage.outputTokens ?? 0;
        }

        if (text) yield { kind: 'text-delta', text };
        break;
      } catch (e) {
        if (loop === this.maxLoops - 1) {
          return {
            text: stringifyError(e),
            toolCalls: allCalls,
            artifacts: allArtifacts,
            errors: allErrors,
            messages,
            usage: {
              inputTokens: totalInput,
              outputTokens: totalOutput,
              totalTokens: totalInput + totalOutput,
            },
          };
        }
      }
    }

    yield { kind: 'finish', text, toolCalls: allCalls };
    return {
      text,
      toolCalls: allCalls,
      artifacts: allArtifacts,
      errors: allErrors,
      messages,
      usage: {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        totalTokens: totalInput + totalOutput,
      },
    };
  }

  async runToCompletion(composed: ComposedRequest, signal?: AbortSignal): Promise<ModelRunResult> {
    const iter = this.run(composed, signal);
    let next = await iter.next();
    while (!next.done) next = await iter.next();
    return next.value;
  }

  private toMessages(composed: ComposedRequest): any[] {
    return composed.messages.map((m) => ({ role: m.role, content: m.content }));
  }
}

function stringifyError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
