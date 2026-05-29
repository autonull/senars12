import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {BotConfig, BotMode, Message, ReasoningArtifact} from './BotContext.js';
import {EventBus} from '../nar/types/events.js';

export class ConversationState {
messages: Message[] = [];
summary?: string;
workingMemory = new Map<string, unknown>();
reasoningArtifacts: ReasoningArtifact[] = [];
pinnedBeliefs = new Set<string>();
mode: BotMode = 'auto';

constructor(
private readonly config: BotConfig,
private eventBus?: EventBus
) {}

addMessage(msg: Message, lm?: LMClient): void {
this.messages.push(msg);
this.eventBus?.emit('conversation:message-added', { message: msg, count: this.messages.length });
if (lm) this.maybeSummarize(lm);
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

private async maybeSummarize(lm: LMClient): Promise<void> {
if (this.messages.length <= this.config.conversation.summaryThreshold) return;
const toSummarize = this.messages.slice(0, -10);
const prompt = `Summarize the following conversation in 2-3 sentences:\n\n${
toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')
}`;
try {
this.summary = await lm.generateText(prompt);
this.messages = this.messages.slice(-10);
this.eventBus?.emit('conversation:summarized', { summary: this.summary });
} catch {
// Summarization failed, continue without summarizing
}
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
