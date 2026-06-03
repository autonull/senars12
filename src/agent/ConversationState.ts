import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {BotConfig, BotMode, Message, ReasoningArtifact} from './types.js';
import {EventBus} from '../nar/types/events.js';

const DEFAULT_SUMMARIZE_DEBOUNCE_MS = 5_000;
const DEFAULT_SUMMARIZE_TIMEOUT_MS = 10_000;
const DEFAULT_PINNED_BELIEF_LIMIT = 8;

export class ConversationState {
messages: Message[] = [];
summary?: string;
workingMemory = new Map<string, unknown>();
reasoningArtifacts: ReasoningArtifact[] = [];
pinnedBeliefs = new Set<string>();
mode: BotMode = 'auto';
private summarizeAbort?: AbortController;
private summarizeTimer?: NodeJS.Timeout;
private inFlightSummarize = false;

constructor(
private readonly config: BotConfig,
private eventBus?: EventBus,
private readonly summarizeDeps?: {debounceMs?: number; timeoutMs?: number; pinnedBeliefLimit?: number}
) {}

addMessage(msg: Message, lm?: LMClient): void {
this.messages.push(msg);
this.eventBus?.emit('conversation:message-added', { message: msg, count: this.messages.length });
if (lm) this.scheduleSummarize(lm);
}

  getHistory(limit?: number): Message[] {
    return limit ? this.messages.slice(-limit) : [...this.messages];
  }

  getContextForLM(maxConcepts: number, nar: NAR): string {
    const parts: string[] = [];
    if (this.summary) parts.push(`Conversation summary: ${this.summary}`);

    const report = nar.attentionReport();
    if (report.concepts.length > 0) {
      parts.push('Knowledge context:');
      for (const c of report.concepts.slice(0, maxConcepts)) {
        parts.push(` - ${c.term} (priority: ${(c.priority * 100).toFixed(0)}%)`);
      }
    }

    const recent = this.getRecentArtifacts(5);
    if (recent.length > 0) {
      parts.push('Recent reasoning:');
      for (const a of recent) parts.push(` - ${a.content}`);
    }

    if (this.pinnedBeliefs.size > 0) {
      parts.push('Pinned context:');
      for (const b of this.pinnedBeliefs) parts.push(` - ${b}`);
    }

    return parts.join('\n');
  }

  set(key: string, value: unknown): void {
    this.workingMemory.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.workingMemory.get(key) as T;
  }

addArtifact(artifact: ReasoningArtifact): void {
this.reasoningArtifacts.push(artifact);
this.eventBus?.emit('conversation:artifact-added', { artifact, count: this.reasoningArtifacts.length });
const max = this.config.conversation.maxArtifacts;
if (this.reasoningArtifacts.length > max) {
this.reasoningArtifacts = this.reasoningArtifacts.slice(-Math.floor(max / 2));
}
}

  getRecentArtifacts(limit = 5): ReasoningArtifact[] {
    return this.reasoningArtifacts.slice(-limit);
  }

  /**
   * Pin top-K beliefs derived from the latest turn's artifacts (Phase 4).
   * `belief_added` artifacts are ranked by content; the rest of the
   * pinned set is preserved up to the configured limit. This is the
   * "pin top-K (config: `pinnedBeliefLimit`, default 8)" piece of
   * Phase 4 reliability.
   */
  pinFromArtifacts(artifacts: ReasoningArtifact[], limit = this.summarizeDeps?.pinnedBeliefLimit ?? DEFAULT_PINNED_BELIEF_LIMIT): void {
    const candidates: string[] = [];
    for (const a of artifacts) {
      if (a.type === 'belief_added' && a.content) candidates.push(a.content);
      const belief = a.metadata?.belief;
      if (typeof belief === 'string' && a.type === 'derivation') candidates.push(belief);
    }
    const existing = [...this.pinnedBeliefs];
    const merged = [...existing, ...candidates].slice(-limit);
    this.pinnedBeliefs = new Set(merged);
    this.eventBus?.emit('conversation:pinned-from-artifacts', {added: candidates.length, total: this.pinnedBeliefs.size});
  }

  /**
   * Add assistant, tool-call and tool-result messages produced by
   * `ModelRunner` back to the conversation so subsequent turns can
   * see them. The user input is added by `AIAgent.runFullTurn`
   * directly; this method handles the assistant side only.
   */
  absorbModelMessages(messages: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]}>): void {
    for (const m of messages) {
      if (m.role === 'user' || m.role === 'system') continue;
      const text = this.contentToText(m.content);
      if (!text) continue;
      this.addMessage({role: 'assistant', content: text, timestamp: Date.now()});
    }
  }

  private contentToText(content: string | unknown[]): string {
    if (typeof content === 'string') return content;
    const parts: string[] = [];
    for (const part of content) {
      const p = part as {type?: string; text?: string; toolName?: string; name?: string; result?: unknown; input?: unknown};
      if (p.type === 'text' && typeof p.text === 'string') parts.push(p.text);
      else if (p.type === 'tool-call') parts.push(`[tool-call ${p.toolName ?? p.name ?? '?'}: ${JSON.stringify(p.input ?? {})} ]`);
      else if (p.type === 'tool-result') parts.push(`[tool-result ${p.toolName ?? p.name ?? '?'}: ${JSON.stringify(p.result ?? '')} ]`);
    }
    return parts.join('\n');
  }

  scheduleSummarize(lm: LMClient): void {
    if (!lm || this.messages.length <= this.config.conversation.summaryThreshold) return;
    if (this.summarizeTimer) clearTimeout(this.summarizeTimer);
    const debounce = this.summarizeDeps?.debounceMs ?? DEFAULT_SUMMARIZE_DEBOUNCE_MS;
    this.summarizeTimer = setTimeout(() => { void this.runSummarize(lm); }, debounce);
    if (typeof this.summarizeTimer?.unref === 'function') this.summarizeTimer.unref();
  }

  cancelSummarize(): void {
    if (this.summarizeTimer) {clearTimeout(this.summarizeTimer); this.summarizeTimer = undefined;}
    this.summarizeAbort?.abort();
    this.summarizeAbort = undefined;
  }

  isSummarizing(): boolean {
    return this.inFlightSummarize;
  }

  private async runSummarize(lm: LMClient): Promise<void> {
    if (this.inFlightSummarize) return;
    this.inFlightSummarize = true;
    this.summarizeAbort?.abort();
    const controller = new AbortController();
    this.summarizeAbort = controller;
    const timeoutMs = this.summarizeDeps?.timeoutMs ?? DEFAULT_SUMMARIZE_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    try {
      const summary = await this.summarizeWith(lm, controller.signal);
      if (summary) {
        this.summary = summary;
        const keep = this.config.conversation.maxHistory ?? 10;
        this.messages = this.messages.slice(-keep);
        this.eventBus?.emit('conversation:summarized', { summary });
      }
    } catch (err) {
      this.eventBus?.emit('conversation:summarize-failed', { error: (err as Error).message });
    } finally {
      clearTimeout(timer);
      this.inFlightSummarize = false;
      if (this.summarizeAbort === controller) this.summarizeAbort = undefined;
    }
  }

  private async summarizeWith(lm: LMClient, signal: AbortSignal): Promise<string | undefined> {
    if (signal.aborted) return undefined;
    const threshold = this.config.conversation.summaryThreshold;
    if (this.messages.length <= threshold) return undefined;
    const toSummarize = this.messages.slice(0, -10);
    const prompt = `Summarize the following conversation in 2-3 sentences:\n\n${
      toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')
    }`;
    return await lm.generateText(prompt, {signal});
  }

pin(belief: string): void {
this.pinnedBeliefs.add(belief);
this.eventBus?.emit('conversation:belief-pinned', { belief, count: this.pinnedBeliefs.size });
}

  unpin(belief: string): void {
    this.pinnedBeliefs.delete(belief);
  }

  getPinned(): string[] {
    return [...this.pinnedBeliefs];
  }

  toJSON(): string {
    return JSON.stringify({
      messages: this.messages,
      summary: this.summary,
      reasoningArtifacts: this.reasoningArtifacts,
      pinnedBeliefs: Array.from(this.pinnedBeliefs),
      mode: this.mode,
      workingMemory: Array.from(this.workingMemory.entries())
    });
  }

  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      this.messages = data.messages || [];
      this.summary = data.summary;
      this.reasoningArtifacts = data.reasoningArtifacts || [];
      this.pinnedBeliefs = new Set(data.pinnedBeliefs || []);
      this.mode = data.mode || 'auto';
      if (data.workingMemory) {
        this.workingMemory = new Map(data.workingMemory);
      }
    } catch (e) {
      console.warn('Failed to parse ConversationState from JSON', e);
    }
  }
}
