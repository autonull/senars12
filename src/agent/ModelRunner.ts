import { drain, errMsg, truncate as truncateText, type LMTask, type ToolCall } from '@senars/util';
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  stepCountIs,
  streamText,
  type ToolSet,
} from 'ai';

export type { LanguageModel, ModelMessage, ToolSet };
/** The one tool-call record: util owns it, the runner and the dispatcher both read it. */
export type { ToolCall };

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

/** `LMTask` under the name the model runner reads by — one tier vocabulary. */
export type ModelTier = LMTask;

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

  getModel(tier: string): LanguageModel | undefined;
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

  /**
   * The run's result, assembled from its accumulators.
   *
   * Every exit from the generator — a provider that never became available, a
   * thrown stream, an abort, the normal finish — returns this same record, so
   * the fields a caller reads cannot be one shape on the happy path and another
   * on a fault. Each accumulator is read once, here, so the usage totals in the
   * result are the totals the stream reported rather than a re-derivation.
   */
  private result(run: {
    text: string;
    toolCalls: ToolCall[];
    artifacts: ReasoningArtifact[];
    errors: ToolError[];
    messages: ModelMessage[];
    inputTokens: number;
    outputTokens: number;
  }): ModelRunResult {
    return {
      text: run.text,
      toolCalls: run.toolCalls,
      artifacts: run.artifacts,
      errors: run.errors,
      messages: run.messages,
      usage: {
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.inputTokens + run.outputTokens,
      },
    };
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

    const hasTools = Object.keys(composed.tools).length > 0;
    // The run's whole state, and the record every exit below returns. One object
    // rather than six locals, so the finish path and the two fault paths cannot
    // each assemble a slightly different answer from the same run.
    const outcome = {
      text: '',
      toolCalls: [] as ToolCall[],
      artifacts: [] as ReasoningArtifact[],
      errors: [] as ToolError[],
      // Resumable state: input messages + completed assistant turn(s).
      messages: composed.messages as ModelMessage[],
      inputTokens: 0,
      outputTokens: 0,
    };

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
            outcome.toolCalls.push(call);
          }
          for (const tr of toolResults ?? []) {
            const call = outcome.toolCalls.find((c) => c.toolCallId === tr.toolCallId);
            const output =
              typeof tr.output === 'string' ? tr.output : JSON.stringify(tr.output ?? null);
            const capped = truncateText(output, this.maxToolResultChars);
            if (call) {
              outcome.artifacts.push({
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
          outcome.text += delta;
          yield { kind: 'text-delta', text: delta };
        }
        if (signal?.aborted) break;
      }
      try {
        outcome.inputTokens += (await stream.usage)?.inputTokens ?? 0;
        outcome.outputTokens += (await stream.usage)?.outputTokens ?? 0;
      } catch {
        /* usage unavailable */
      }
      void generateText;

      // Resumable state: append completed assistant turn(s) (incl. tool
      // calls/results) to the input messages so callers can continue the
      // conversation. Multi-step runs expose per-step messages on `steps`.
      try {
        const steps = await stream.steps;
        const stepMessages = (steps ?? []).flatMap((s) => s.response?.messages ?? []);
        if (stepMessages.length > 0) outcome.messages = [...composed.messages, ...stepMessages];
      } catch {
        /* steps unavailable (e.g. aborted) */
      }

      for (const c of outcome.toolCalls.slice(0, this.maxToolResultEntries)) {
        yield { kind: 'tool-call', call: c };
      }
      const artifacts = outcome.artifacts.slice(0, this.maxToolResultEntries);
      for (const a of artifacts) {
        const call = outcome.toolCalls.find((c) => c.toolCallId === a.metadata?.toolCallId) ?? {
          toolName: String(a.metadata?.toolName ?? 'tool'),
          toolCallId: String(a.metadata?.toolCallId ?? ''),
          args: {},
        };
        yield { kind: 'tool-result', call, result: a.content };
      }

      if (signal?.aborted)
        yield { kind: 'finish', text: outcome.text, toolCalls: outcome.toolCalls };
    } catch (e) {
      if (signal?.aborted) {
        yield { kind: 'finish', text: outcome.text, toolCalls: outcome.toolCalls };
        return this.result(outcome);
      }
      outcome.text = errMsg(e);
      return this.result(outcome);
    }

    yield { kind: 'finish', text: outcome.text, toolCalls: outcome.toolCalls };
    return this.result(outcome);
  }

  async runToCompletion(composed: ComposedRequest, signal?: AbortSignal): Promise<ModelRunResult> {
    return drain(this.run(composed, signal));
  }

  private toMessages(composed: ComposedRequest): ModelMessage[] {
    return composed.messages;
  }
}
