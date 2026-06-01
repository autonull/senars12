/**
 * TUI (Terminal User Interface) components
 * Provides visual conventions, status bar, and enhanced REPL support
 */

export interface TUIConfig {
  showReasoningSteps: boolean;
  showConfidence: boolean;
  showToolCalls: boolean;
  typingIndicator: boolean;
  colors: boolean;
  compactMode: boolean;
  statusBar: boolean;
}

export const DEFAULT_TUI_CONFIG: TUIConfig = {
  showReasoningSteps: true,
  showConfidence: false,
  showToolCalls: true,
  typingIndicator: true,
  colors: true,
  compactMode: false,
  statusBar: true,
};

/**
 * Visual conventions
 * - User input: `> your message`
 * - Bot response: `bot: response text`
 * - Reasoning step: ` → (<A --> B>. :0.9:0.8)` (dimmed)
 * - Tool call: ` ⚙ tool:calculate(2+2) = 4`
 * - Command output: ` /status → ...` (formatted block)
 * - Error: ` ✗ error: description` (red)
 * - Streaming status: ` ⏳ thinking...` (spinner)
 * - Mode indicator: `[auto]`, `[chat]`, `[reason]`
 * - Capability status: `[LM✓]`, `[LM✗]`, `[NAR✓]`, `[NAR✗]`
 */

export const VISUAL = {
  userInput: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[36m>\x1b[0m' : '>';
    return `${prefix} ${text}`;
  },

  botResponse: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[32mbot:\x1b[0m' : 'bot:';
    return `${prefix} ${text}`;
  },

  reasoningStep: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[2m →\x1b[0m' : ' →';
    return `${prefix} ${text}`;
  },

  toolCall: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[36m ⚙\x1b[0m' : ' ⚙';
    return `${prefix} ${text}`;
  },

  commandOutput: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[33m /\x1b[0m' : ' /';
    return `${prefix}${text}`;
  },

  error: (text: string, colors: boolean = true): string => {
    const prefix = colors ? '\x1b[31m ✗\x1b[0m' : ' ✗';
    return `${prefix} ${text}`;
  },

  thinking: (text: string = 'thinking...', colors: boolean = true): string => {
    const prefix = colors ? '\x1b[90m ⏳\x1b[0m' : ' ⏳';
    return `${prefix} ${text}`;
  },

  modeIndicator: (mode: string, colors: boolean = true): string => {
    const modeText = `[${mode}]`;
    return colors ? `\x1b[1m${modeText}\x1b[0m` : modeText;
  },

  capabilityStatus: (name: string, available: boolean, colors: boolean = true): string => {
    const symbol = available ? '✓' : '✗';
    const color = available ? '\x1b[32m' : '\x1b[31m';
    const text = colors ? `${color}[${name}${symbol}]\x1b[0m` : `[${name}${symbol}]`;
    return text;
  },

  statusBar: (parts: string[], colors: boolean = true): string => {
    const separator = colors ? '\x1b[90m | \x1b[0m' : ' | ';
    const line = colors ? '\x1b[90m─'.repeat(60) + '\x1b[0m' : '-'.repeat(60);
    return `${line}\n${parts.join(separator)}`;
  },
};

export interface StatusBarData {
  lmModel?: string;
  lmAvailable: boolean;
  narConcepts: number;
  narAvailable: boolean;
  turn: number;
  mode: string;
  goals?: {
    active: number;
    satisfied: number;
  };
}

export function buildStatusBar(data: StatusBarData, config: TUIConfig): string {
  if (!config.statusBar) return '';

  const parts: string[] = [];

  if (data.lmAvailable) {
    parts.push(VISUAL.capabilityStatus(`LM:${data.lmModel || 'default'}`, true, config.colors));
  } else {
    parts.push(VISUAL.capabilityStatus('LM', false, config.colors));
  }

  if (data.narAvailable) {
    parts.push(VISUAL.capabilityStatus(`NAR:${data.narConcepts}`, true, config.colors));
  } else {
    parts.push(VISUAL.capabilityStatus('NAR', false, config.colors));
  }

  parts.push(VISUAL.modeIndicator(data.mode, config.colors));
  parts.push(`turn: ${data.turn}`);

  if (data.goals && data.goals.active > 0) {
    const pct = data.goals.satisfied / data.goals.active;
    parts.push(`goals:${data.goals.active} ✓${data.goals.satisfied} ${(pct * 100).toFixed(0)}%`);
  }

  return VISUAL.statusBar(parts, config.colors);
}
