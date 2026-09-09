import { termParser } from '../terms/index.js';
import type { Term } from '../terms/index.js';

export interface FirewallVerdict {
  allowed: boolean;
  reason?: string;
}

export interface FirewallOptions {
  maxLength?: number;
  maxDepth?: number;
  maxConfidence?: number;
  absoluteConfidence?: number;
  blockOperators?: boolean;
  allowedPredicates?: string[];
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

const DEFAULTS: Required<Omit<FirewallOptions, 'extraBlockedPatterns' | 'allowedPredicates'>> = {
  maxLength: 500,
  maxDepth: 8,
  maxConfidence: 0.7,
  absoluteConfidence: 0.95,
  blockOperators: true,
};

function astDepth(term: Term): number {
  let max = 0;
  const visit = (t: Term, depth: number): void => {
    if (!t || typeof t !== 'object') return;
    max = Math.max(max, depth);
    for (const child of [t.subject, t.predicate, ...(t.components ?? []), ...(t.args ?? [])]) {
      if (child !== undefined) visit(child, depth + 1);
    }
  };
  visit(term, 0);
  return max;
}

export class SymbolicFirewall {
  private readonly maxLength: number;
  private readonly maxDepth: number;
  private readonly maxConfidence: number;
  private readonly absoluteConfidence: number;
  private readonly blockOperators: boolean;
  private readonly allowedPredicates?: Set<string>;
  private readonly blocked: RegExp[];

  constructor(opts: FirewallOptions = {}) {
    const cfg = { ...DEFAULTS, ...opts };
    this.maxLength = cfg.maxLength;
    this.maxDepth = cfg.maxDepth;
    this.maxConfidence = cfg.maxConfidence;
    this.absoluteConfidence = cfg.absoluteConfidence;
    this.blockOperators = cfg.blockOperators;
    this.allowedPredicates = opts.allowedPredicates ? new Set(opts.allowedPredicates) : undefined;
    this.blocked = [...BLOCKED_PATTERNS, ...(opts.extraBlockedPatterns ?? [])];
  }

  check(narsese: string, kind: 'belief' | 'goal' | 'question' = 'belief'): FirewallVerdict {
    const cleaned = narsese.replace(/^`+|`+$/g, '').trim();
    if (!cleaned) return { allowed: false, reason: 'empty statement' };
    if (cleaned.length > this.maxLength)
      return { allowed: false, reason: `exceeds max length ${this.maxLength}` };
    for (const pattern of this.blocked) {
      if (pattern.test(cleaned))
        return { allowed: false, reason: `blocked pattern ${pattern.source}` };
    }
    if (this.blockOperators && OPERATOR_PATTERN.test(cleaned)) {
      return { allowed: false, reason: 'LLM may not mint ^operator goals directly' };
    }
    const truthMatch = /%([\d.]+)\s*;\s*([\d.]+)%/.exec(cleaned);
    const confidence = truthMatch ? Number.parseFloat(truthMatch[2]!) : undefined;
    if (confidence !== undefined && !(confidence <= this.absoluteConfidence))
      return { allowed: false, reason: `confidence ${confidence} exceeds absolute bound ${this.absoluteConfidence}` };
    let term: Term;
    try {
      term = termParser.parse(cleaned.replace(/[.?!]$/, ''));
    } catch {
      return { allowed: false, reason: 'unparseable Narsese' };
    }
    if (astDepth(term) > this.maxDepth)
      return { allowed: false, reason: `exceeds max AST depth ${this.maxDepth}` };
    if (this.allowedPredicates && !this.predicatesAllowed(term)) {
      return { allowed: false, reason: 'predicate outside whitelist' };
    }
    if (kind === 'goal' && !/[!]$/.test(narsese.trim()) && OPERATOR_PATTERN.test(cleaned)) {
      return { allowed: false, reason: 'operator invocation outside goal position' };
    }
    return { allowed: true };
  }

  clampConfidence(c: number): number {
    return Math.min(Math.max(c, 0), this.maxConfidence);
  }

  checkTruth(f: number, c: number): FirewallVerdict {
    return c > this.absoluteConfidence || f < 0 || f > 1 || c < 0 || c > 1
      ? { allowed: false, reason: `truth {f=${f}, c=${c}} violates sanity bounds` }
      : { allowed: true };
  }

  private predicatesAllowed(term: Term): boolean {
    const allowed = this.allowedPredicates!;
    const names = new Set<string>();
    const visit = (t: Term): void => {
      if (!t || typeof t !== 'object') return;
      if (t.kind === 'atom' && typeof t.symbol === 'string') names.add(t.symbol);
      for (const child of [t.subject, t.predicate, ...(t.components ?? []), ...(t.args ?? [])]) {
        if (child !== undefined) visit(child);
      }
    };
    visit(term);
    return [...names].every((n) => n.startsWith('^') || n.startsWith('?') || allowed.has(n));
  }
}

export const defaultFirewall = new SymbolicFirewall();
