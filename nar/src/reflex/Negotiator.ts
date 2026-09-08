import {ActionProposal, LearningEvent} from './Reflex.js';
import {Focus} from '../focus/Focus.js';
import type {Perception} from '../game/Game.js';

export interface NALDerivation {
  action: string;
  truth: { f: number; c: number };
  source: string;
}

export interface NegotiationDecision {
  action: string | null;
  actionExecuted: string | null;
  vetoedBy: string | null;
  confidence: number;
  source: 'reflex' | 'nal' | 'none';
}

export interface NegotiatorOptions {
  nalVetoThreshold?: number;
  reflexThreshold?: number;
}

export class Negotiator {
  private readonly nalVetoThreshold: number;
  private readonly reflexThreshold: number;

  constructor(options: NegotiatorOptions = {}) {
    this.nalVetoThreshold = options.nalVetoThreshold ?? 0.8;
    this.reflexThreshold = options.reflexThreshold ?? 0.3;
  }

  resolve(
    reflexProposals: ActionProposal[],
    nalDerivations: NALDerivation[]
  ): NegotiationDecision {
    if (reflexProposals.length === 0) {
      return { action: null, actionExecuted: null, vetoedBy: null, confidence: 0, source: 'none' };
    }

    const bestReflex = reflexProposals.reduce((best, p) =>
      p.value * p.confidence > best.value * best.confidence ? p : best
    );

    if (bestReflex.value * bestReflex.confidence < this.reflexThreshold) {
      return { action: null, actionExecuted: null, vetoedBy: 'below-threshold', confidence: 0, source: 'none' };
    }

    for (const derivation of nalDerivations) {
      if (derivation.action === bestReflex.action) {
        // Veto if NAL derives this action leads to bad outcome (low frequency = trap)
        if (derivation.truth.f < 0.3 && derivation.truth.c >= this.nalVetoThreshold) {
          return {
            action: bestReflex.action,
            actionExecuted: null,
            vetoedBy: `nal-${derivation.source}`,
            confidence: derivation.truth.c,
            source: 'nal',
          };
        }
      }

      if (this.isVetoingAction(derivation, bestReflex.action)) {
        return {
          action: bestReflex.action,
          actionExecuted: null,
          vetoedBy: `nal-${derivation.source}-veto`,
          confidence: derivation.truth.c,
          source: 'nal',
        };
      }
    }

    return {
      action: bestReflex.action,
      actionExecuted: bestReflex.action,
      vetoedBy: null,
      confidence: bestReflex.confidence,
      source: 'reflex',
    };
  }

  private isVetoingAction(derivation: NALDerivation, proposedAction: string): boolean {
    return derivation.truth.f < 0.3 && derivation.truth.c >= this.nalVetoThreshold;
  }

  createLearningEvent(
    focus: Focus,
    decision: NegotiationDecision,
    outcome: { reward: number; terminal: boolean; perception: any; previousPerception?: Perception | null }
  ): LearningEvent {
    return {
      perception: outcome.perception,
      previousPerception: outcome.previousPerception ?? null,
      actionProposed: decision.action ?? '',
      actionExecuted: decision.actionExecuted,
      reward: outcome.reward,
      terminal: outcome.terminal,
      overriddenBy: decision.vetoedBy,
    };
  }
}