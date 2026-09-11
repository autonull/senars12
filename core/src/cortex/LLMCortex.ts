import type { ChatStreamEvent } from '../ChatService.js';
import type { CognitiveStimulus, Context, Derivation } from '../engine/Engine.js';
import type {
  ComposedRequest,
  ModelEvent,
  ModelRunner,
  ModelTier,
  ToolSet,
} from '../ModelRunner.js';

export interface CortexSynthesizeRequest {
  stimulus: CognitiveStimulus;
  context: Context;
  derivations: Derivation[];
  systemPrompt?: string;
  tools?: ToolSet;
  tier?: ModelTier;
  maxTokens?: number;
}

export interface CortexSynthesizeResponse {
  text: string;
  events: ChatStreamEvent[];
}

export interface PromptBuilder {
  build(req: CortexSynthesizeRequest & { workingMemory: unknown[] }): string;
}

export class LLMCortex {
  #runner: ModelRunner;
  #promptBuilder?: PromptBuilder;

  constructor(runner: ModelRunner, promptBuilder?: PromptBuilder) {
    this.#runner = runner;
    this.#promptBuilder = promptBuilder;
  }

  setPromptBuilder(builder: PromptBuilder): void {
    this.#promptBuilder = builder;
  }

  async *synthesizeStream(
    req: CortexSynthesizeRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ChatStreamEvent, string> {
    const composed = this.#compose(req);
    let text = '';
    for await (const ev of this.#runner.run(composed, signal)) {
      const chatEv = this.#toChatEvent(ev);
      yield chatEv;
      if (ev.kind === 'text-delta') text += ev.text;
    }
    const finalText = text || this.#fallbackResponse(req);
    if (!text) yield { kind: 'text-delta', text: finalText };
    return finalText;
  }

  async synthesize(req: CortexSynthesizeRequest): Promise<CortexSynthesizeResponse> {
    const composed = this.#compose(req);

    const stream = this.#runner.run(composed);

    let text = '';
    const events: ChatStreamEvent[] = [];

    for await (const ev of stream) {
      events.push(this.#toChatEvent(ev));
      if (ev.kind === 'text-delta') text += ev.text;
    }

    return { text: text || this.#fallbackResponse(req), events };
  }

  #compose(req: CortexSynthesizeRequest): ComposedRequest {
    const systemPrompt = req.systemPrompt ?? this.#buildDefaultPrompt(req);
    const historyText = req.context.working.map((e) => JSON.stringify(e)).join('\n');
    const estimate = (s: string): number => Math.ceil(s.length / 4);
    const systemTokens = estimate(systemPrompt);
    const historyTokens = estimate(historyText) + estimate(req.stimulus.text);
    return {
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: req.stimulus.text }],
      tools: req.tools ?? ({} as ToolSet),
      tier: req.tier,
      ctxHash: String(Date.now()),
      snapshot: null,
      budget: {
        systemTokens,
        historyTokens,
        snapshotTokens: 0,
        total: systemTokens + historyTokens,
        maxTokens: req.maxTokens ?? 0,
      },
    };
  }

  #toChatEvent(ev: ModelEvent): ChatStreamEvent {
    switch (ev.kind) {
      case 'text-delta':
        return { kind: 'text-delta', text: ev.text };
      case 'tool-call':
        return { kind: 'tool-call', toolName: ev.call.toolName, toolArgs: ev.call.args };
      case 'tool-result':
        return {
          kind: 'tool-result',
          toolName: ev.call.toolName,
          toolArgs: ev.call.args,
          toolResult: ev.result,
        };
      case 'finish':
        return { kind: 'finish', text: ev.text };
      case 'tool-error':
        return { kind: 'error', error: ev.error };
    }
  }

  #buildDefaultPrompt(req: CortexSynthesizeRequest): string {
    const derivations = req.derivations
      .map(
        (d) =>
          `- ${d.term}${d.truth ? ` (f=${d.truth.frequency.toFixed(2)}, c=${d.truth.confidence.toFixed(2)})` : ''}`
      )
      .join('\n');

    return [
      'You are a cognitive agent with access to symbolic reasoning engines.',
      'Synthesize a natural language response based on the input and any derivations.',
      '',
      derivations ? `Relevant derivations:\n${derivations}` : '',
      '',
      this.#promptBuilder
        ? this.#promptBuilder.build({
            ...req,
            workingMemory: req.context.working,
          })
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  #fallbackResponse(req: CortexSynthesizeRequest): string {
    if (req.derivations.length > 0) {
      return `I derived ${req.derivations.length} result(s).`;
    }
    return `[agent] ${req.stimulus.text}`;
  }
}
