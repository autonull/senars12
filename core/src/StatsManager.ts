export interface AgentStats {
  totalChats: number;
  successfulChats: number;
  failedChats: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalDurationMs: number;
  averageDurationMs: number;
  startedAt: number;
}

export class StatsManager {
  private stats: AgentStats = {
    totalChats: 0,
    successfulChats: 0,
    failedChats: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalDurationMs: 0,
    averageDurationMs: 0,
    startedAt: Date.now(),
  };

  recordStats(
    status: 'success' | 'failure',
    durationMs: number,
    tokens?: { inputTokens: number; outputTokens: number; totalTokens: number }
  ): void {
    this.stats.totalChats++;
    if (status === 'success') this.stats.successfulChats++;
    else this.stats.failedChats++;

    this.stats.totalDurationMs += durationMs;
    this.stats.averageDurationMs = Math.round(this.stats.totalDurationMs / this.stats.totalChats);

    if (tokens) {
      this.stats.totalInputTokens += tokens.inputTokens;
      this.stats.totalOutputTokens += tokens.outputTokens;
      this.stats.totalTokens += tokens.totalTokens;
    }
  }

  getStats(): Readonly<AgentStats> {
    return { ...this.stats };
  }
}
