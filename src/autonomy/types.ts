import type { NAREventMap } from '../types/events.js';
import type { AutonomyMode, AutonomyPolicyId } from './config.js';

/** One concept the curiosity policy may ask about: its term, best-belief confidence, priority. */
export interface ConceptObservation {
  term: string;
  /** The highest confidence among the concept's beliefs; 0 when it holds none. */
  confidence: number;
  priority: number;
}

/** What a policy records as its reason — carried whole on the emitted event (C5.4). */
export interface AutonomyProvenance {
  policy: AutonomyPolicyId;
  trigger: string;
  concept?: string;
  cycle: number;
}

/**
 * The kernel surface the heartbeat drives, named as the one operation it needs
 * of each — so the loop is a pure consumer of memory, the kernel step and the
 * bus, and never reaches into the NAR.
 */
export interface AutonomyPorts {
  cycle(): number;
  now(): number;
  /** Advance exactly one kernel cycle (the kernel's own primitive). */
  step(): Promise<number>;
  /** Live store pressure in `0..1`. */
  pressure(): number;
  conceptCount(): number;
  observations(): ReadonlyArray<ConceptObservation>;
  /** Admit an internally-minted question through the one perception gate. */
  admitQuestion(narsese: string, correlationId: string): Promise<void>;
  /** Capture a checkpoint before a consolidation pass, so the pass can be undone (C5.5). */
  checkpoint(cycle: number): void;
  /** Run the single decay/eviction sweep. */
  consolidate(cycle: number): void;
  evictionReport(): { archived: number; forgotten: number } | undefined;
  emit<K extends keyof NAREventMap & string>(event: K, data: NAREventMap[K]): void;
}

/** What one heartbeat tick did, for a direct caller. */
export interface AutonomyTickReport {
  stepped: number;
  question: string | null;
  consolidated: boolean;
  /** Set when the window budget halted the heartbeat; the matching event is emitted. */
  halted: string | null;
}

export type { AutonomyMode };
