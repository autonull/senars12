import type { CognitiveStimulus, Context, Derivation } from '../engine/Engine.js';
import type { ModelRunner, ModelEvent } from '../ModelRunner.js';
import type { ChatStreamEvent } from '../ChatService.js';

export interface CortexSynthesizeRequest {
  stimulus: CognitiveStimulus;
  context: Context;
  derivations: Derivation[];
  systemPrompt?: string;
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

  async synthesize(req: CortexSynthesizeRequest): Promise<CortexSynthesizeResponse> {
    const systemPrompt = req.systemPrompt ?? this.#buildDefaultPrompt(req);
    const composed = {
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: req.stimulus.text }],
      tools: {} as Record<string, unknown>,
      ctxHash: String(Date.now()),
      snapshot: null,
      budget: { systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0 },
    };

    const stream = this.#runner.run(composed);

    let text = '';
    const events: ChatStreamEvent[] = [];

    for await (const ev of stream) {
      events.push(this.#toChatEvent(ev));
      if (ev.kind === 'text-delta') text += ev.text;
    }

    return { text: text || this.#fallbackResponse(req), events };
  }

  #toChatEvent(ev: ModelEvent): ChatStreamEvent {
    switch (ev.kind) {
      case 'text-delta': return { kind: 'text-delta', text: ev.text };
      case 'tool-call': return { kind: 'tool-call', toolName: ev.call.toolName, toolArgs: ev.call.args };
      case 'tool-result': return { kind: 'tool-result', toolName: ev.call.toolName, toolArgs: ev.call.args, toolResult: ev.result };
      case 'finish': return { kind: 'finish', text: ev.text };
      case 'tool-error': return { kind: 'error', error: ev.error };
    }
  }

  #buildDefaultPrompt(req: CortexSynthesizeRequest): string {
    const derivations = req.derivations
      .map((d) => `- ${d.term}${d.truth ? ` (f=${d.truth.frequency.toFixed(2)}, c=${d.truth.confidence.toFixed(2)})` : ''}`)
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
