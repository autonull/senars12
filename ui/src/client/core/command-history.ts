/**
 * Recently-run commands (§3.5, Phase 0.5). The palette surfaces an MRU group so
 * the commands a session leans on stay one keystroke away. Module-level and
 * session-scoped; `dispatchCommand` is the single recorder, so palette, HUD and
 * agent runs all feed it.
 */

const MAX_RECENT = 5;

let order: string[] = [];

export const recordCommandUse = (id: string): void => {
  order = [id, ...order.filter((existing) => existing !== id)].slice(0, MAX_RECENT);
};

export const recentCommandIds = (): readonly string[] => order;

export const resetCommandHistory = (): void => {
  order = [];
};
