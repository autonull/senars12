/**
 * Book — artifact collections with versioning and composition.
 *
 * Books are immutable snapshots of admitted artifacts for
 * reproducible reasoning and sharing.
 */

import type { Artifact, ArtifactKind, ArtifactStatus } from './repertoire';
import type { Term } from '../kernel/terms/term';
import type { TruthValue } from '../kernel/truth';
import type { Clock, RNG, TimestampMs } from '../kernel/env';
import { createDefaultClock, createDefaultRNG } from '../kernel/env';
import { FluentBuilderMixin } from '@senars/util/fluent-builder';

/** Book entry. */
export interface BookEntry {
  /** Artifact ID. */
  artifactId: string;
  /** Artifact kind. */
  kind: ArtifactKind;
  /** Term. */
  term: Term;
  /** Truth. */
  truth: TruthValue;
  /** Status at time of inclusion. */
  status: ArtifactStatus;
  /** Inclusion timestamp. */
  includedAt: number;
  /** Tags. */
  tags: string[];
}

/** Book metadata. */
export interface BookMetadata {
  /** Book ID. */
  id: string;
  /** Title. */
  title: string;
  /** Description. */
  description: string;
  /** Version. */
  version: string;
  /** Author. */
  author: string;
  /** Created at. */
  createdAt: number;
  /** Updated at. */
  updatedAt: number;
  /** Tags. */
  tags: string[];
  /** Parent book (for derivation). */
  parentId?: string;
  /** Hash for integrity. */
  hash: string;
}

/** Book — immutable artifact collection. */
export interface Book {
  /** Metadata. */
  metadata: BookMetadata;
  /** Entries. */
  entries: BookEntry[];
}

/** Book builder step record. */
export interface BookBuilderStep {
  step: string;
  present: boolean;
  detail?: Record<string, unknown>;
}

/** Compute simple hash for book integrity. */
function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/** Book builder for constructing books. */
export class BookBuilder extends FluentBuilderMixin<Book, BookBuilderStep>() {
  private metadata: Partial<BookMetadata> = {};
  private entries: BookEntry[] = [];
  private artifactMap: Map<string, Artifact> = new Map();
  private clock: Clock;
  private rng: RNG;

  constructor(clock?: Clock, rng?: RNG) {
    super();
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Set book metadata. */
  setMetadata(metadata: Partial<BookMetadata>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this.recordStep('setMetadata', true);
  }

  /** Add artifact to book. */
  addArtifact(artifact: Artifact): this {
    this.artifactMap.set(artifact.id, artifact);
    this.entries.push({
      artifactId: artifact.id,
      kind: artifact.kind,
      term: artifact.term,
      truth: artifact.truth,
      status: artifact.status,
      includedAt: this.clock.now(),
      tags: artifact.tags,
    });
    return this.recordStep('addArtifact', true, { artifactId: artifact.id });
  }

  /** Add multiple artifacts. */
  addArtifacts(artifacts: Artifact[]): this {
    for (const artifact of artifacts) {
      this.addArtifact(artifact);
    }
    return this.recordStep('addArtifacts', true, { count: artifacts.length });
  }

  /** Build the book. */
  override build(): Book {
    const now = this.clock.now();
    const id = this.metadata.id ?? `book-${now}-${this.rng.next().toString(36).slice(2, 8)}`;
    const version = this.metadata.version ?? '1.0.0';

    const fullMetadata: BookMetadata = {
      id,
      title: this.metadata.title ?? 'Untitled Book',
      description: this.metadata.description ?? '',
      version,
      author: this.metadata.author ?? 'system',
      createdAt: this.metadata.createdAt ?? now,
      updatedAt: now,
      tags: this.metadata.tags ?? [],
      parentId: this.metadata.parentId,
      hash: '',
    };

    // Compute hash
    const content = JSON.stringify({ metadata: { ...fullMetadata, hash: '' }, entries: this.entries });
    fullMetadata.hash = computeHash(content);

    return {
      metadata: fullMetadata,
      entries: this.entries,
    };
  }
}

/** Book library — manages multiple books. */
export class BookLibrary {
  private books: Map<string, Book> = new Map();
  private byTag: Map<string, Set<string>> = new Map();
  private clock: Clock;
  private rng: RNG;

  constructor(clock?: Clock, rng?: RNG) {
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Add a book. */
  addBook(book: Book): void {
    this.books.set(book.metadata.id, book);
    for (const tag of book.metadata.tags) {
      const set = this.byTag.get(tag) ?? new Set();
      set.add(book.metadata.id);
      this.byTag.set(tag, set);
    }
  }

  /** Get book by ID. */
  getBook(id: string): Book | undefined {
    return this.books.get(id);
  }

  /** Get books by tag. */
  getBooksByTag(tag: string): Book[] {
    const ids = this.byTag.get(tag);
    if (!ids) return [];
    return Array.from(ids).map(id => this.books.get(id)!).filter(Boolean);
  }

  /** Get all books. */
  getAllBooks(): Book[] {
    return Array.from(this.books.values());
  }

  /** Derive a new book from existing. */
  deriveBook(
    parentId: string,
    newTitle: string,
    additions: Artifact[],
    removals: string[] = [],
    author = 'system'
  ): Book | null {
    const parent = this.books.get(parentId);
    if (!parent) return null;

    // Start with parent entries minus removals
    const entries = parent.entries.filter(e => !removals.includes(e.artifactId));
    const existingIds = new Set(entries.map(e => e.artifactId));

    // Add new artifacts
    for (const artifact of additions) {
      if (!existingIds.has(artifact.id)) {
        entries.push({
          artifactId: artifact.id,
          kind: artifact.kind,
          term: artifact.term,
          truth: artifact.truth,
          status: artifact.status,
          includedAt: this.clock.now(),
          tags: artifact.tags,
        });
        existingIds.add(artifact.id);
      }
    }

    // Build derived book
    const builder = new BookBuilder(this.clock, this.rng)
      .setMetadata({
        title: newTitle,
        description: `Derived from ${parent.metadata.title}`,
        author,
        parentId,
        tags: [...parent.metadata.tags, 'derived'],
      });

    for (const entry of entries) {
      builder.addArtifact({
        id: entry.artifactId,
        kind: entry.kind,
        term: entry.term,
        truth: entry.truth,
        status: entry.status,
        createdAt: entry.includedAt,
        modifiedAt: entry.includedAt,
        events: [],
        dependencies: [],
        tags: entry.tags,
        metrics: {
          usageCount: 0,
          successRate: 1,
          avgUtility: 0,
          lastUsed: entry.includedAt,
          confidenceTrend: 0,
        },
      });
    }

    return builder.build();
  }

  /** Verify book integrity. */
  verifyBook(id: string): { valid: boolean; errors: string[] } {
    const book = this.books.get(id);
    if (!book) {
      return { valid: false, errors: ['Book not found'] };
    }

    const errors: string[] = [];
    const content = JSON.stringify({ metadata: { ...book.metadata, hash: '' }, entries: book.entries });
    const computedHash = computeHash(content);

    if (computedHash !== book.metadata.hash) {
      errors.push('Hash mismatch: book may have been modified');
    }

    return { valid: errors.length === 0, errors };
  }
}

/** Create a book builder. */
export function createBookBuilder(clock?: Clock, rng?: RNG): BookBuilder {
  return new BookBuilder(clock, rng);
}

/** Create a book library. */
export function createBookLibrary(clock?: Clock, rng?: RNG): BookLibrary {
  return new BookLibrary(clock, rng);
}