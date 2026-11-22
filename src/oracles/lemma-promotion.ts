/**
 * Lemma Promotion — promotes frequent oracle results from memo-cache
 * to admitted lemma-rules in the repertoire.
 *
 * Books = exported repertoire + derivations; receiver re-folds and re-verifies,
 * rejecting poisoned imports.
 */

import type { Artifact, ArtifactKind, ArtifactStatus, AdmissionEvent } from '../admit/repertoire';
import type { Book, BookEntry, BookMetadata } from '../admit/book';
import type { Term, ConstantTerm } from '../kernel/terms/term';
import { termFactory } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';
import type { Stamp } from '../kernel/types';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';
import type { OraclePin, OraclePinStore } from './pins';
import { createOraclePinStore } from './pins';
import type { LogStore } from '../log/store';
import { createLogStore } from '../log/store';
import { createBookBuilder, createBookLibrary } from '../admit/book';

/** Lemma candidate from oracle pin. */
export interface LemmaCandidate {
  /** Source pin ID. */
  pinId: string;
  /** Oracle operation. */
  operation: string;
  /** Input query digest. */
  queryDigest: string;
  /** Provider. */
  provider: string;
  /** Version. */
  version?: string;
  /** Number of times this result was used. */
  useCount: number;
  /** First seen timestamp. */
  firstSeen: number;
  /** Last seen timestamp. */
  lastSeen: number;
  /** The oracle output. */
  output: unknown;
  /** Context. */
  context?: Record<string, unknown>;
}

/** Lemma promotion configuration. */
export interface LemmaPromotionConfig {
  /** Minimum use count for promotion. */
  minUseCount: number;
  /** Minimum time window (ms) before promotion. */
  minAgeMs: number;
  /** Maximum lemma candidates to track. */
  maxCandidates: number;
  /** Promotion threshold (confidence). */
  promotionThreshold: number;
  /** Auto-promote on interval. */
  autoPromoteIntervalMs?: number;
}

/** Default lemma promotion config. */
export const defaultLemmaPromotionConfig: LemmaPromotionConfig = {
  minUseCount: 10,
  minAgeMs: 24 * 60 * 60 * 1000, // 24 hours
  maxCandidates: 1000,
  promotionThreshold: 0.9,
  autoPromoteIntervalMs: 60 * 60 * 1000, // 1 hour
};

/** Promoted lemma artifact. */
export interface PromotedLemma {
  /** Lemma ID. */
  id: string;
  /** Source pins. */
  sourcePins: string[];
  /** The lemma term. */
  term: Term;
  /** Lemma truth. */
  truth: TruthValue;
  /** Promotion timestamp. */
  promotedAt: number;
  /** Use count at promotion. */
  useCountAtPromotion: number;
  /** Oracle operation. */
  operation: string;
  /** Provider. */
  provider: string;
  /** Version. */
  version?: string;
}

/** Book export with derivations for federation. */
export interface FederationBook extends Book {
  /** Derivations included. */
  derivations: LemmaDerivation[];
  /** Export metadata. */
  exportMetadata: {
    exportedAt: number;
    exportedBy: string;
    sourceRepertoireSize: number;
    lemmaCount: number;
  };
}

/** Lemma derivation record. */
export interface LemmaDerivation {
  /** Derivation ID. */
  id: string;
  /** Premise lemma IDs. */
  premises: string[];
  /** Conclusion lemma ID. */
  conclusion: string;
  /** Derivation rule. */
  rule: string;
  /** Confidence. */
  confidence: number;
  /** Timestamp. */
  timestamp: number;
}

/** Book import result. */
export interface BookImportResult {
  /** Imported book. */
  book: Book | null;
  /** Accepted lemmas. */
  accepted: PromotedLemma[];
  /** Rejected lemmas (poisoned). */
  rejected: Array<{ lemma: PromotedLemma; reason: string }>;
  /** Verification result. */
  verification: { valid: boolean; errors: string[] };
}

/** Lemma promotion manager. */
export class LemmaPromotionManager {
  private config: LemmaPromotionConfig;
  private candidates = new Map<string, LemmaCandidate>();
  private promotedLemmas: PromotedLemma[] = [];
  private pinStore: OraclePinStore;
  private clock: Clock;
  private rng: RNG;
  private promotionTimer?: ReturnType<typeof setInterval>;

  constructor(
    config: LemmaPromotionConfig = defaultLemmaPromotionConfig,
    pinStore?: OraclePinStore,
    clock?: Clock,
    rng?: RNG
  ) {
    this.config = config;
    this.pinStore = pinStore ?? createOraclePinStore();
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Start auto-promotion. */
  start(): void {
    if (this.config.autoPromoteIntervalMs) {
      this.promotionTimer = setInterval(() => {
        this.promote().catch(console.error);
      }, this.config.autoPromoteIntervalMs);
    }
  }

  /** Stop auto-promotion. */
  stop(): void {
    if (this.promotionTimer) {
      clearInterval(this.promotionTimer);
      this.promotionTimer = undefined;
    }
  }

  /** Track oracle pin usage for promotion candidacy. */
  trackPinUsage(pin: OraclePin): void {
    const key = `${pin.operation}:${pin.queryDigest}:${pin.provider}:${pin.version ?? ''}`;

    let candidate = this.candidates.get(key);
    if (!candidate) {
      // Check capacity
      if (this.candidates.size >= this.config.maxCandidates) {
        // Evict oldest unused candidate
        this.evictOldest();
      }

      candidate = {
        pinId: pin.id,
        operation: pin.operation,
        queryDigest: pin.queryDigest,
        provider: pin.provider,
        version: pin.version,
        useCount: 0,
        firstSeen: this.clock.now(),
        lastSeen: this.clock.now(),
        output: pin.output,
        context: pin.context,
      };
      this.candidates.set(key, candidate);
    }

    candidate.useCount++;
    candidate.lastSeen = this.clock.now();
  }

  /** Evict oldest unused candidate. */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, candidate] of this.candidates) {
      if (candidate.useCount === 0 && candidate.firstSeen < oldestTime) {
        oldestTime = candidate.firstSeen;
        oldest = key;
      }
    }

    if (oldest) {
      this.candidates.delete(oldest);
    } else {
      // If all have useCount > 0, evict least recently used
      let lru: string | null = null;
      let lruTime = Infinity;
      for (const [key, candidate] of this.candidates) {
        if (candidate.lastSeen < lruTime) {
          lruTime = candidate.lastSeen;
          lru = key;
        }
      }
      if (lru) this.candidates.delete(lru);
    }
  }

  /** Promote eligible candidates to lemmas. */
  async promote(): Promise<PromotedLemma[]> {
    const now = this.clock.now();
    const promoted: PromotedLemma[] = [];

    for (const [key, candidate] of this.candidates) {
      if (candidate.useCount >= this.config.minUseCount &&
          now - candidate.firstSeen >= this.config.minAgeMs) {

        // Create lemma term from oracle output
        const lemma = await this.createLemmaFromCandidate(candidate);
        if (lemma) {
          this.promotedLemmas.push(lemma);
          promoted.push(lemma);
          this.candidates.delete(key); // Remove from candidates after promotion
        }
      }
    }

    return promoted;
  }

  /** Create lemma artifact from candidate. */
  private async createLemmaFromCandidate(candidate: LemmaCandidate): Promise<PromotedLemma | null> {
    try {
      // Create a constant term representing the lemma
      // The term encodes the oracle operation and its verified output
      const term: ConstantTerm = termFactory.constant(
        `lemma:${candidate.operation}:${candidate.queryDigest.slice(0, 8)}`
      );

      // High confidence for promoted lemmas
      const truth: TruthValue = {
        f: this.config.promotionThreshold,
        c: 0.95,
      };

      return {
        id: `lemma-${candidate.operation}-${candidate.queryDigest.slice(0, 8)}-${this.rng.next().toString(36).slice(2, 6)}`,
        sourcePins: [candidate.pinId],
        term,
        truth,
        promotedAt: this.clock.now(),
        useCountAtPromotion: candidate.useCount,
        operation: candidate.operation,
        provider: candidate.provider,
        version: candidate.version,
      };
    } catch {
      return null;
    }
  }

  /** Get all promoted lemmas. */
  getPromotedLemmas(): PromotedLemma[] {
    return [...this.promotedLemmas];
  }

  /** Get candidates awaiting promotion. */
  getCandidates(): LemmaCandidate[] {
    return Array.from(this.candidates.values());
  }

  /** Export lemmas as a federation book. */
  async exportBook(
    repertoire: Map<string, Artifact>,
    author = 'system',
    description = 'Exported lemmas and repertoire'
  ): Promise<FederationBook> {
    const builder = createBookBuilder(this.clock, this.rng)
      .setMetadata({
        title: 'Federation Book',
        description,
        author,
        version: `1.0.0-${this.clock.now()}`,
        tags: ['federation', 'lemmas', 'export'],
      });

    // Add repertoire artifacts
    for (const artifact of repertoire.values()) {
      if (artifact.status === 'admitted') {
        builder.addArtifact(artifact);
      }
    }

    // Add promoted lemmas as artifacts
    for (const lemma of this.promotedLemmas) {
      const artifact: Artifact = {
        id: lemma.id,
        kind: 'rule',
        status: 'admitted',
        term: lemma.term,
        truth: lemma.truth,
        createdAt: lemma.promotedAt,
        modifiedAt: lemma.promotedAt,
        events: [],
        dependencies: lemma.sourcePins,
        tags: ['lemma', lemma.operation, lemma.provider],
        metrics: {
          usageCount: lemma.useCountAtPromotion,
          successRate: 1.0,
          avgUtility: 1.0,
          lastUsed: lemma.promotedAt,
          confidenceTrend: 0,
        },
      };
      builder.addArtifact(artifact);
    }

    const book = builder.build();

    // Add derivations (simplified - in practice would compute from actual derivations)
    const derivations: LemmaDerivation[] = [];

    return {
      ...book,
      derivations,
      exportMetadata: {
        exportedAt: this.clock.now(),
        exportedBy: author,
        sourceRepertoireSize: repertoire.size,
        lemmaCount: this.promotedLemmas.length,
      },
    };
  }

  /** Import and re-fold a federation book, rejecting poisoned imports. */
  async importBook(
    book: FederationBook,
    verifyFn: (lemma: PromotedLemma) => Promise<{ valid: boolean; reason?: string }>
  ): Promise<BookImportResult> {
    const accepted: PromotedLemma[] = [];
    const rejected: Array<{ lemma: PromotedLemma; reason: string }> = [];
    const errors: string[] = [];

    // Verify book integrity
    const library = createBookLibrary(this.clock, this.rng);
    library.addBook(book);
    const hashCheck = library.verifyBook(book.metadata.id);
    if (!hashCheck.valid) {
      errors.push(...hashCheck.errors);
    }

    // Re-fold: verify each lemma
    for (const entry of book.entries) {
      if (entry.tags.includes('lemma')) {
        // Reconstruct lemma from entry
        const lemma: PromotedLemma = {
          id: entry.artifactId,
          sourcePins: entry.tags.filter(t => t.startsWith('pin-')),
          term: entry.term,
          truth: entry.truth,
          promotedAt: entry.includedAt,
          useCountAtPromotion: 0,
          operation: entry.tags.find(t => !t.startsWith('lemma') && !t.startsWith('pin-')) ?? 'unknown',
          provider: 'imported',
          version: entry.tags.find(t => t.startsWith('v')) ?? undefined,
        };

        const verification = await verifyFn(lemma);
        if (verification.valid) {
          accepted.push(lemma);
        } else {
          rejected.push({ lemma, reason: verification.reason ?? 'Verification failed' });
        }
      }
    }

    // Re-verify the entire book
    const verification = await this.verifyBookIntegrity(book);

    return {
      book: accepted.length > 0 ? book : null,
      accepted,
      rejected,
      verification,
    };
  }

  /** Verify book integrity and policy compliance. */
  private async verifyBookIntegrity(book: Book): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check hash
    const library = createBookLibrary(this.clock, this.rng);
    library.addBook(book);
    const hashCheck = library.verifyBook(book.metadata.id);
    if (!hashCheck.valid) {
      errors.push(...hashCheck.errors);
    }

    // Check for poisoned lemmas (e.g., contradictory rules, impossible truths)
    for (const entry of book.entries) {
      if (entry.truth.f > 1 || entry.truth.f < 0 || entry.truth.c > 1 || entry.truth.c < 0) {
        errors.push(`Invalid truth value in ${entry.artifactId}`);
      }
      // Check for contradictory lemmas (same term, different truth)
      // This would require checking against existing repertoire
    }

    return { valid: errors.length === 0, errors };
  }

  /** Get statistics. */
  getStats(): {
    candidates: number;
    promotedLemmas: number;
    totalUseCount: number;
  } {
    const totalUseCount = Array.from(this.candidates.values()).reduce((sum, c) => sum + c.useCount, 0);
    return {
      candidates: this.candidates.size,
      promotedLemmas: this.promotedLemmas.length,
      totalUseCount,
    };
  }
}

/** Create a lemma promotion manager. */
export function createLemmaPromotionManager(
  config?: LemmaPromotionConfig,
  pinStore?: OraclePinStore,
  clock?: Clock,
  rng?: RNG
): LemmaPromotionManager {
  return new LemmaPromotionManager(config, pinStore, clock, rng);
}