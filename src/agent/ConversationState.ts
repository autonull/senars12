import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {BotConfig, BotMode, Message, ReasoningArtifact} from './BotContext.js';

export class ConversationState {
  messages: Message[] = [];
  summary?: string;
  workingMemory = new Map<string, unknown>();
  reasoningArtifacts: ReasoningArtifact[] = [];
  pinnedBeliefs = new Set<string>();
  mode: BotMode = 'auto';

  constructor(private readonly config: BotConfig) {}

  addMessage(msg: Message, lm?: LMClient): void {
    this.messages.push(msg);
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
    } catch {
      // Summarization failed, continue without summarizing
    }
  }
}
