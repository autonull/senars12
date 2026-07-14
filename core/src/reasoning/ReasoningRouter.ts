import type { ChatMessage } from '../Protocol.js';
import type { BackendInput } from './BackendTypes.js';
import type { Capability } from './Capability.js';
import type { ReasoningBackend } from './ReasoningBackend.js';

export interface RouteStep {
  readonly backendId: string;
  readonly type: BackendInput['type'];
  readonly content: string;
  readonly dependsOn?: string[];
}

export interface Route {
  readonly steps: RouteStep[];
  readonly primaryBackend: string;
}

export class ReasoningRouter {
  constructor(private backends: Map<string, ReasoningBackend>) {}

  route(input: string, history: ChatMessage[]): Route {
    if (this.isNarsese(input)) {
      return this.makeRoute('nar', 'belief', input);
    }
    if (this.isMettaSyntax(input)) {
      return this.makeRoute('metta', 'skill', input);
    }

    const requiredCaps = this.inferCapabilities(input, history);
    const backendScores = this.scoreBackends(requiredCaps);

    const best = backendScores[0];
    const second = backendScores[1];
    if (best && best.score > 0.8 && (!second || best.score > second.score + 0.3)) {
      return this.makeRoute(best.id, 'chat', input);
    }

    return this.makePipeline(backendScores, input, requiredCaps);
  }

  routeForChat(input: string, _history: ChatMessage[]): Route {
    if (this.isNarsese(input)) {
      return this.makeRoute('nar', 'belief', input);
    }
    if (input.startsWith('skill:') || input.startsWith('(skill ')) {
      return this.makeRoute('metta', 'skill', input);
    }
    if (this.isMettaSyntax(input)) {
      return this.makeRoute('metta', 'skill', input);
    }
    return this.makeRoute('nar', 'chat', input);
  }

  private isNarsese(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed) return false;
    if (/<.*--[>-]/.test(trimmed)) return true;
    if (/^[(\[{&|~-]/.test(trimmed) && /[.!?]$/.test(trimmed)) return true;
    return false;
  }

  private isMettaSyntax(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) return true;
    if (/^(skill|match|rewrite|query|import)\b/.test(trimmed)) return true;
    return false;
  }

  private inferCapabilities(input: string, _history: ChatMessage[]): Capability[] {
    const caps: Capability[] = [];
    const lower = input.toLowerCase();

    if (lower.includes('believe') || lower.includes('inherit') || /<.*-->/.test(input)) {
      caps.push('inheritance', 'truth-revision');
    }
    if (lower.includes('goal') || lower.includes('want') || lower.includes('achieve')) {
      caps.push('goal-management');
    }
    if (lower.includes('remember') || lower.includes('recall') || lower.includes('memory')) {
      caps.push('episodic-memory', 'long-term-memory');
    }
    if (lower.includes('skill') || lower.includes('execute') || lower.includes('run')) {
      caps.push('skill-execution');
    }
    if (lower.includes('match') || lower.includes('pattern') || /\(match\b/.test(input)) {
      caps.push('pattern-match');
    }
    if (lower.includes('rewrite') || /\(rewrite\b/.test(input)) {
      caps.push('rewrite');
    }
    if (lower.includes('query') || /\(query\b/.test(input)) {
      caps.push('query');
    }

    return [...new Set(caps)];
  }

  private scoreBackends(required: Capability[]): Array<{ id: string; score: number }> {
    return [...this.backends.entries()]
      .map(([id, backend]) => {
        const supported = [...backend.capabilities];
        const matched = required.filter((c) => supported.includes(c)).length;
        const score = required.length > 0 ? matched / required.length : 0;
        return { id, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  private makeRoute(backendId: string, type: BackendInput['type'], content: string): Route {
    return {
      steps: [{ backendId, type, content }],
      primaryBackend: backendId,
    };
  }

  private makePipeline(
    backendScores: Array<{ id: string; score: number }>,
    input: string,
    _requiredCaps: Capability[]
  ): Route {
    const primary = backendScores[0]?.id ?? 'nar';
    const steps: RouteStep[] = backendScores
      .filter((s) => s.score > 0)
      .map((s) => ({
        backendId: s.id,
        type: 'chat' as BackendInput['type'],
        content: input,
      }));
    if (steps.length === 0) {
      steps.push({ backendId: 'nar', type: 'chat', content: input });
    }
    return { steps, primaryBackend: primary };
  }
}
