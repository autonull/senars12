import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  stepCountIs,
  streamText,
  type ToolSet,
} from 'ai';

export type { LanguageModel, ModelMessage, ToolSet };

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

export type ModelTier = 'quality' | 'fast' | 'structured';

export interface ComposedRequest {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  ctxHash: string;
  snapshot: unknown;
  tier?: ModelTier;
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
  messages: ModelMessage[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface ModelProvider {
  readonly available: boolean;

  getModel(tier?: string): LanguageModel | undefined;
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

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

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
    const empty = {
      text: '',
      toolCalls: [],
      artifacts: [],
      errors: [],
      messages: composed.messages,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    } satisfies ModelRunResult;
    if (!this.modelProvider?.available) return empty;

    const model = this.modelProvider.getModel(composed.tier ?? 'fast');
    if (!model) {
      return { ...empty, text: 'No model available' };
    }

    const allCalls: ToolCall[] = [];
    const allArtifacts: ReasoningArtifact[] = [];
    const allErrors: ToolError[] = [];
    let text = '';
    let totalInput = 0;
    let totalOutput = 0;

    const hasTools = Object.keys(composed.tools).length > 0;

    try {
      const stream = streamText({
        model,
        messages: this.toMessages(composed),
        instructions: composed.system || undefined,
        tools: hasTools ? composed.tools : undefined,
        stopWhen: hasTools ? stepCountIs(this.maxLoops) : stepCountIs(1),
        maxOutputTokens: this.maxOutputTokens,
        abortSignal: signal,
        onStepFinish: async ({ toolCalls, toolResults }) => {
          for (const tc of toolCalls ?? []) {
            const call: ToolCall = {
              toolName: tc.toolName,
              toolCallId: tc.toolCallId,
              args: (tc.input as Record<string, unknown>) ?? {},
            };
            allCalls.push(call);
          }
          for (const tr of toolResults ?? []) {
            const call = allCalls.find((c) => c.toolCallId === tr.toolCallId);
            const output =
              typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output ?? null);
            const capped = truncate(output, this.maxToolResultChars);
            if (call) {
              allArtifacts.push({
                type: 'tool_result',
                content: capped,
                timestamp: Date.now(),
                metadata: { toolName: call.toolName, toolCallId: call.toolCallId },
              });
            }
          }
        },
      });

      for await (const delta of stream.textStream) {
        if (delta) {
          text += delta;
          yield { kind: 'text-delta', text: delta };
        }
        if (signal?.aborted) break;
      }
      try {
        totalInput += (await stream.usage)?.inputTokens ?? 0;
        totalOutput += (await stream.usage)?.outputTokens ?? 0;
      } catch {
        /* usage unavailable */
      }
      void generateText;

      for (const c of allCalls.slice(0, this.maxToolResultEntries)) {
        yield { kind: 'tool-call', call: c };
      }
      const artifacts = allArtifacts.slice(0, this.maxToolResultEntries);
      for (const a of artifacts) {
        const call = allCalls.find((c) => c.toolCallId === a.metadata?.toolCallId) ?? {
          toolName: String(a.metadata?.toolName ?? 'tool'),
          toolCallId: String(a.metadata?.toolCallId ?? ''),
          args: {},
        };
        yield { kind: 'tool-result', call, result: a.content };
      }

      if (signal?.aborted) yield { kind: 'finish', text, toolCalls: allCalls };
    } catch (e) {
      if (signal?.aborted) {
        yield { kind: 'finish', text, toolCalls: allCalls };
        return {
          text,
          toolCalls: allCalls,
          artifacts: allArtifacts,
          errors: allErrors,
          messages: composed.messages,
          usage: {
            inputTokens: totalInput,
            outputTokens: totalOutput,
            totalTokens: totalInput + totalOutput,
          },
        };
      }
      return {
        text: stringifyError(e),
        toolCalls: allCalls,
        artifacts: allArtifacts,
        errors: allErrors,
        messages: composed.messages,
        usage: {
          inputTokens: totalInput,
          outputTokens: totalOutput,
          totalTokens: totalInput + totalOutput,
        },
      };
    }

    yield { kind: 'finish', text, toolCalls: allCalls };
    return {
      text,
      toolCalls: allCalls,
      artifacts: allArtifacts,
      errors: allErrors,
      messages: composed.messages,
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

  private toMessages(composed: ComposedRequest): ModelMessage[] {
    return composed.messages;
  }
}

function stringifyError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
