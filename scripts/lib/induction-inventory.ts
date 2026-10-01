/**
 * The in-cycle induction inventory's verdict logic (TODO29.a §11.1 Q1′).
 *
 * Kept pure and separate from the script that reads the tree so the rules are
 * testable on objects rather than on a checkout. Four checks, and each exists
 * because the cheaper version of it passes silently:
 *
 *  - **an unaccounted cycle-path import fails.** A new `import` from the cycle
 *    into the layer is undeclared behaviour by definition, and behaviour is the
 *    unit the plan reasons in.
 *  - **a call site that has moved fails.** `file:line` is a reference, not a
 *    promise; a dead reference in a ledger reads exactly like a live one, which
 *    is the accumulator ledger's own failure mode in reverse.
 *  - **a seam naming no declared behaviour fails.** Otherwise the provider
 *    seams and the inventory are two documents about the same cycle.
 *  - **a behaviour with no attribution fails.** A row in the inventory that no
 *    import edge backs is a claim; the audit is what makes it an observation.
 *
 * Type-only edges are counted and reported but not required to be attributed:
 * a type is erased, so a type import is a vocabulary dependency and A2's
 * subject, not a behaviour.
 */

export interface DiscoveredEdge {
  /** Repo-relative source path. */
  readonly file: string;
  /** Module specifier as written. */
  readonly specifier: string;
  readonly typeOnly: boolean;
  readonly line: number;
}

export interface InventoryFailure {
  readonly kind:
    | 'unattributed-cycle-import'
    | 'dead-call-site'
    | 'unaccounted-seam-behaviour'
    | 'unattributed-behaviour';
  readonly subject: string;
  readonly detail: string;
}

/** Byte offset → 1-based line number. */
export const lineOf = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

/**
 * Whether an import clause binds only types.
 *
 * `importEdges` deliberately does not answer this — a type-only import that
 * points upward is still an upward edge for `deps:direction`, which has no use
 * for the exemption. This gate does need it, and the answer is lexical: the
 * clause is type-only when every one of its bindings is prefixed `type`, or the
 * clause itself is `import type`.
 */
export const isTypeOnlyImport = (source: string, offset: number): boolean => {
  const end = source.indexOf(';', offset);
  const clause = source.slice(offset, end === -1 ? offset + 300 : end);
  if (/^\s*import\s+type\b/.test(clause)) return true;
  const bindings = clause.match(/\{([^}]*)\}/)?.[1];
  if (bindings === undefined) return false;
  // A default or namespace binding is a value, whatever the braces beside it say.
  if (!/^\s*import\s*(?:type\s+)?from\b/.test(clause.replace(/\{[^}]*\}/, ''))) return false;
  const named = bindings
    .split(',')
    .map((part) =>
      part
        .replace(/\btype\b/, '')
        .split(' as ')[0]
        ?.trim()
    )
    .filter((name): name is string => Boolean(name));
  return (
    named.length > 0 &&
    named.every((name) => new RegExp(String.raw`\btype\s+${name}\b`).test(bindings))
  );
};

export interface InventorySubject {
  /** The edges a scan found, already restricted to the layer. */
  readonly edges: readonly DiscoveredEdge[];
  /** Declared behaviours, by id. */
  readonly behaviours: readonly { id: string }[];
  /** Declared call sites, `file:line`, with the text each must still contain. */
  readonly callSites: readonly { ref: string; contains: string }[];
  /** File contents by repo-relative path — enough to resolve a call site. */
  readonly sources: ReadonlyMap<string, string>;
  /** Which declared behaviour owns each cycle-path file's imports. */
  readonly attributions: readonly { file: string; behaviour: string }[];
  /** Which cycle-path files import the layer at all. */
  readonly cyclePathFiles: readonly string[];
}

const parseRef = (ref: string): { file: string; line: number } | null => {
  const match = /^(.*):(\d+)$/.exec(ref);
  return match ? { file: match[1]!, line: Number(match[2]) } : null;
};

/** Whether `file:line` still holds the text the ledger says it does. */
export const callSiteHolds = (
  source: string | undefined,
  line: number,
  contains: string
): boolean => source !== undefined && (source.split('\n')[line - 1] ?? '').includes(contains);

export const checkInventory = (subject: InventorySubject): InventoryFailure[] => {
  const failures: InventoryFailure[] = [];
  const behaviourIds = new Set(subject.behaviours.map((b) => b.id));
  const attributed = new Map(subject.attributions.map((a) => [a.file, a.behaviour]));
  const onCyclePath = new Set(subject.cyclePathFiles);

  for (const edge of subject.edges) {
    if (edge.typeOnly || !onCyclePath.has(edge.file)) continue;
    if (!attributed.has(edge.file)) {
      failures.push({
        kind: 'unattributed-cycle-import',
        subject: `${edge.file}:${edge.line}`,
        detail: `imports '${edge.specifier}' from the cycle path with no declared behaviour`,
      });
    }
  }

  for (const attribution of subject.attributions) {
    if (!subject.cyclePathFiles.includes(attribution.file)) {
      failures.push({
        kind: 'unattributed-behaviour',
        subject: attribution.file,
        detail: `attributes '${attribution.behaviour}' to a file that no longer imports the layer`,
      });
    }
    if (!behaviourIds.has(attribution.behaviour)) {
      failures.push({
        kind: 'unaccounted-seam-behaviour',
        subject: attribution.file,
        detail: `attributes an undeclared behaviour '${attribution.behaviour}'`,
      });
    }
  }

  for (const seam of subject.callSites) {
    const parsed = parseRef(seam.ref);
    const source = parsed ? subject.sources.get(parsed.file) : undefined;
    if (!parsed || !seam.contains || source === undefined) {
      failures.push({
        kind: 'dead-call-site',
        subject: seam.ref,
        detail: parsed
          ? `no source at ${parsed.file}`
          : 'a call site must be `file:line` plus the text it must still contain',
      });
    } else if (!callSiteHolds(source, parsed.line, seam.contains)) {
      failures.push({
        kind: 'dead-call-site',
        subject: seam.ref,
        detail: `line ${parsed.line} no longer contains '${seam.contains}'`,
      });
    }
  }

  return failures;
};
