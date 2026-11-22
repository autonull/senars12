/**
 * Books Re-fold — integrate books with the admission lifecycle.
 *
 * Books are immutable snapshots of admitted artifacts for reproducible
 * reasoning and sharing. They re-fold through the lifecycle gates.
 */

import type { Artifact, ArtifactKind, ArtifactStatus, AdmissionEvent } from './repertoire';
import type { Book, BookEntry, BookMetadata } from './book';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';
import { createPolicyEngine, type PolicyEngine, type PolicyEvaluation } from './policies';
import { createProjectionEngine, type ProjectionEngine, type ProjectionRule } from './projections';
import { createAdmissionMachinery, type AdmissionMachinery, type AdmissionProposal } from './admission-machinery';

/** Re-fold configuration. */
export interface RefoldConfig {
  /** Policy engine. */
  policyEngine: PolicyEngine;
  /** Projection engine. */
  projectionEngine: ProjectionEngine;
  /** Admission machinery. */
  admissionMachinery: AdmissionMachinery;
  /** Auto-create books on admission. */
  autoBookOnAdmit: boolean;
  /** Book version prefix. */
  bookVersionPrefix: string;
}

/** Re-fold result. */
export interface RefoldResult {
  /** Book created/updated. */
  book?: Book;
  /** Admission events. */
  events: AdmissionEvent[];
  /** Policy evaluations. */
  policyEvaluations: PolicyEvaluation[];
  /** Projections applied. */
  projections: Array<{ ruleId: string; result: unknown }>;
  /** Proposals created. */
  proposals: AdmissionProposal[];
  /** Success. */
  success: boolean;
  /** Errors. */
  errors: string[];
}

/** Book lifecycle manager. */
export class BookLifecycleManager {
  private config: RefoldConfig;
  private clock: Clock;
  private rng: RNG;

  constructor(config: RefoldConfig, clock?: Clock, rng?: RNG) {
    this.config = config;
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Re-fold artifacts into a book. */
  async refold(
    artifacts: Artifact[],
    metadata: Partial<BookMetadata> = {}
  ): Promise<RefoldResult> {
    const errors: string[] = [];
    const events: AdmissionEvent[] = [];
    const policyEvaluations: PolicyEvaluation[] = [];
    const projections: Array<{ ruleId: string; result: unknown }> = [];
    const proposals: AdmissionProposal[] = [];

    try {
      // 1. Evaluate policies for each artifact
      for (const artifact of artifacts) {
        const evaluations = await this.config.policyEngine.evaluate(artifact, 'admission', {
          repertoire: artifacts,
          external: {},
        });
        policyEvaluations.push(...evaluations);

        // Check for denials
        const denied = evaluations.some(e => e.action === 'deny');
        if (denied) {
          errors.push(`Artifact ${artifact.id} denied by policy`);
          continue;
        }

        // Check for quarantine
        const quarantined = evaluations.some(e => e.action === 'quarantine');
        if (quarantined) {
          // In a real implementation, this would quarantine the artifact
          events.push({
            type: 'quarantine',
            artifactId: artifact.id,
            timestamp: this.clock.now(),
            reason: 'Policy quarantine',
            actor: 'policy-engine',
            previousStatus: artifact.status,
            newStatus: 'quarantined',
            metadata: {},
          });
          continue;
        }

        // Check for A/B trial
        const trialEval = evaluations.find(e => e.action === 'a-b-trial');
        if (trialEval && trialEval.trialState) {
          // Trial logic handled in policy engine
        }
      }

      // 2. Apply projections to admitted artifacts
      const admittedArtifacts = artifacts.filter(a => a.status === 'admitted');
      for (const artifact of admittedArtifacts) {
        const applicableRules = this.config.projectionEngine.findApplicableRules(
          [{ term: artifact.term, truth: artifact.truth }]
        );

        for (const rule of applicableRules.slice(0, 3)) { // Limit projections
          const result = this.config.projectionEngine.applyRule(rule.id, [
            { term: artifact.term, truth: artifact.truth },
          ]);
          if (result) {
            projections.push({ ruleId: rule.id, result });
          }
        }
      }

      // 3. Create book if enabled
      let book: Book | undefined;
      if (this.config.autoBookOnAdmit && admittedArtifacts.length > 0) {
        const { createBookBuilder } = await import('./book');
        const builder = createBookBuilder(this.clock, this.rng)
          .setMetadata({
            title: metadata.title ?? `Book ${this.clock.now()}`,
            description: metadata.description ?? 'Auto-generated from admitted artifacts',
            author: metadata.author ?? 'system',
            version: `${this.config.bookVersionPrefix}.${this.rng.next().toString(36).slice(2, 6)}`,
            tags: metadata.tags ?? ['auto', 'refold'],
            parentId: metadata.parentId,
          });

        for (const artifact of admittedArtifacts) {
          builder.addArtifact(artifact);
        }

        book = builder.build();
      }

      // 4. Create admission proposals for artifacts that need review
      for (const artifact of artifacts) {
        const reviewEval = policyEvaluations.find(
          e => e.artifactId === artifact.id && e.action === 'require-review'
        );
        if (reviewEval && artifact.status !== 'admitted') {
          // Create a proposal for admission
          const proposal = await this.config.admissionMachinery.createCodeProposal(
            `Admit ${artifact.kind}: ${artifact.id}`,
            `Admission proposal for ${artifact.kind} artifact`,
            [], // Would contain actual file changes in real implementation
            { artifactId: artifact.id, artifactKind: artifact.kind }
          );
          proposals.push(proposal);
        }
      }

      return {
        book,
        events,
        policyEvaluations,
        projections,
        proposals,
        success: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        events,
        policyEvaluations,
        projections,
        proposals,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /** Create a book from admitted artifacts with full lifecycle. */
  async createBookFromRepertoire(
    artifacts: Artifact[],
    title: string,
    description: string,
    author = 'system'
  ): Promise<Book> {
    const admittedArtifacts = artifacts.filter(a => a.status === 'admitted');

    const { createBookBuilder } = await import('./book');
    const builder = createBookBuilder(this.clock, this.rng)
      .setMetadata({
        title,
        description,
        author,
        version: `1.0.0`,
        tags: ['refold', 'lifecycle'],
      });

    for (const artifact of admittedArtifacts) {
      builder.addArtifact(artifact);
    }

    return builder.build();
  }

  /** Derive a new book with lifecycle validation. */
  async deriveBook(
    parentBook: Book,
    newTitle: string,
    additions: Artifact[],
    removals: string[],
    author = 'system'
  ): Promise<Book | null> {
    // Validate additions through policy engine
    const evaluations = await this.config.policyEngine.evaluate(additions[0]!, 'admission', {
      repertoire: [...additions, ...parentBook.entries.map(e => ({
        id: e.artifactId,
        kind: e.kind,
        status: e.status as ArtifactStatus,
        term: e.term,
        truth: e.truth,
        createdAt: e.includedAt,
        modifiedAt: e.includedAt,
        events: [],
        dependencies: [],
        tags: e.tags,
        metrics: { usageCount: 0, successRate: 1, avgUtility: 0, lastUsed: e.includedAt, confidenceTrend: 0 },
      }))],
      external: {},
    });

    const denied = evaluations.some(e => e.action === 'deny');
    if (denied) return null;

    const { createBookLibrary } = await import('./book');
    const library = createBookLibrary(this.clock, this.rng);
    library.addBook(parentBook);

    return library.deriveBook(parentBook.metadata.id, newTitle, additions, removals, author);
  }

  /** Verify book integrity and policy compliance. */
  async verifyBook(book: Book): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Verify book hash
    const { createBookLibrary } = await import('./book');
    const library = createBookLibrary(this.clock, this.rng);
    library.addBook(book);
    const hashCheck = library.verifyBook(book.metadata.id);
    if (!hashCheck.valid) {
      errors.push(...hashCheck.errors);
    }

    // Verify artifacts against policies
    for (const entry of book.entries) {
      const artifact: Artifact = {
        id: entry.artifactId,
        kind: entry.kind,
        status: entry.status,
        term: entry.term,
        truth: entry.truth,
        createdAt: entry.includedAt,
        modifiedAt: entry.includedAt,
        events: [],
        dependencies: [],
        tags: entry.tags,
        metrics: { usageCount: 0, successRate: 1, avgUtility: 0, lastUsed: entry.includedAt, confidenceTrend: 0 },
      };

      const evaluations = await this.config.policyEngine.evaluate(artifact, 'operation', {
        repertoire: book.entries.map(e => ({
          id: e.artifactId,
          kind: e.kind,
          status: e.status as ArtifactStatus,
          term: e.term,
          truth: e.truth,
          createdAt: e.includedAt,
          modifiedAt: e.includedAt,
          events: [],
          dependencies: [],
          tags: e.tags,
          metrics: { usageCount: 0, successRate: 1, avgUtility: 0, lastUsed: e.includedAt, confidenceTrend: 0 },
        })),
        external: {},
      });

      const denied = evaluations.some(e => e.action === 'deny');
      if (denied) {
        errors.push(`Artifact ${entry.artifactId} violates operation policy`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/** Create book lifecycle manager. */
export function createBookLifecycleManager(
  config: RefoldConfig,
  clock?: Clock,
  rng?: RNG
): BookLifecycleManager {
  return new BookLifecycleManager(config, clock, rng);
}

/** Create default re-fold config. */
export function createDefaultRefoldConfig(
  workspaceRoot: string
): RefoldConfig {
  const policyEngine = createPolicyEngine();
  const projectionEngine = createProjectionEngine();
  const { ShadowWorktreeManager } = require('../tools/adapters/shadow-worktree');
  const { DefaultExternalRunner, DefaultHumanApproval, createAdmissionMachinery } = require('./admission-machinery');
  const { createDefaultClock } = require('../kernel/env');

  const clock = createDefaultClock();
  const shadowMgr = new ShadowWorktreeManager(workspaceRoot);

  const admissionMachinery = createAdmissionMachinery({
    workspaceRoot,
    externalRunner: new DefaultExternalRunner(shadowMgr),
    humanApproval: new DefaultHumanApproval(clock),
    autoMerge: false,
    maxConcurrent: 10,
    proposalTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Register default policies
  const { DEFAULT_FACULTY_POLICIES, DEFAULT_PROFILE_POLICIES, DEFAULT_ORACLE_POLICIES } = require('./policies');
  for (const policy of DEFAULT_FACULTY_POLICIES) {
    policyEngine.registerFacultyPolicy(policy);
  }
  for (const policy of DEFAULT_PROFILE_POLICIES) {
    policyEngine.registerProfilePolicy(policy);
  }
  for (const policy of DEFAULT_ORACLE_POLICIES) {
    policyEngine.registerOraclePolicy(policy);
  }

  // Verify projection rules
  projectionEngine.verifyAll();

  return {
    policyEngine,
    projectionEngine,
    admissionMachinery,
    autoBookOnAdmit: true,
    bookVersionPrefix: 'v',
  };
}