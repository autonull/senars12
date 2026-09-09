import { termParser } from '../terms/index.js';

export interface FirewallVerdict {
  allowed: boolean;
  reason?: string;
}

export interface FirewallOptions {
  maxLength?: number;
  maxDepth?: number;
  maxConfidence?: number;
  blockOperators?: boolean;
  extraBlockedPatterns?: RegExp[];
}

const BLOCKED_PATTERNS: RegExp[] = [
  /ignore[\s_]+(all[\s_]+)?(previous|prior)[\s_]+(beliefs|instructions|goals)/i,
  /output[\s_]+(the[\s_]+)?system[\s_]+prompt/i,
  /override[\s_]+(safety|policy|guardrail)/i,
  /forget[\s_]+(everything|all)/i,
  /delete[\s_]+(all|every)[\s_]+(belief|concept|memory)/i,
  /self[\s_-]?modify/i,
  /bypass[\s_]+(validation|firewall|policy)/i,
];

const OPERATOR_PATTERN = /\^[\w-]+/;

const DEFAULTS: Required<Omit<FirewallOptions, 'extraBlockedPatterns'>> = {
  maxLength: 500,
  maxDepth: 8,
  maxConfidence: 0.7,
  blockOperators: true,
};

function nestingDepth(s: string): number {
  let depth = 0;
  let max = 0;
  for (const ch of s) {
    if (ch === '(') {
      depth++;
      max = Math.max(max, depth);
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

export class SymbolicFirewall {
  private readonly maxLength: number;
  private readonly maxDepth: number;
  private readonly maxConfidence: number;
  private readonly blockOperators: boolean;
  private readonly blocked: RegExp[];

  constructor(opts: FirewallOptions = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    this.maxLength = cfg.maxLength;
    this.maxDepth = cfg.maxDepth;
    this.maxConfidence = cfg.maxConfidence;
    this.blockOperators = cfg.blockOperators;
    this.blocked = [...BLOCKED_PATTERNS, ...(opts.extraBlockedPatterns ?? [])];
  }

  check(narsese: string, kind: 'belief' | 'goal' | 'question' = 'belief'): FirewallVerdict {
    const cleaned = narsese.replace(/^`+|`+$/g, '').trim();
    if (!cleaned) return { allowed: false, reason: 'empty statement' };
    if (cleaned.length > this.maxLength)
      return { allowed: false, reason: `exceeds max length ${this.maxLength}` };
    if (nestingDepth(cleaned) > this.maxDepth)
      return { allowed: false, reason: `exceeds max depth ${this.maxDepth}` };
    for (const pattern of this.blocked) {
      if (pattern.test(cleaned))
        return { allowed: false, reason: `blocked pattern ${pattern.source}` };
    }
    if (this.blockOperators && OPERATOR_PATTERN.test(cleaned)) {
      return { allowed: false, reason: 'LLM may not mint ^operator goals directly' };
    }
    try {
      termParser.parse(cleaned.replace(/[.?!]$/, ''));
    } catch {
      return { allowed: false, reason: 'unparseable Narsese' };
    }
    if (kind === 'goal' && !/[!]$/.test(narsese.trim()) && OPERATOR_PATTERN.test(cleaned)) {
      return { allowed: false, reason: 'operator invocation outside goal position' };
    }
    return { allowed: true };
  }

  clampConfidence(c: number): number {
    return Math.min(Math.max(c, 0), this.maxConfidence);
  }
}

export const defaultFirewall = new SymbolicFirewall();
