/**
 * A source-anchored declaration that a call still lives where a ledger says it does.
 *
 * Ledgers that name their call sites used to carry `file:line` plus the text that
 * must be on that line. The line was redundant with the text and worse than
 * redundant: it made the ledger expire whenever anything above it in the file
 * changed height, so the gates that read it went red on an unrelated edit and
 * the fix every time was to re-record the number — a witness that verifies
 * nothing the text does not already verify, maintained by hand.
 *
 * The text is the address. A witness is therefore *content-anchored*: it holds
 * when the file still contains the call, wherever that call has moved to, and
 * fails only when the call is gone or the file with it. That is the whole class
 * of defect worth catching — a seam whose await was deleted must not survive as
 * a declaration.
 */
export interface Witness {
  /** Repo-relative path of the file the call must live in. */
  readonly file: string;
  /**
   * Text that must still appear in that file — distinctive enough to name one
   * call, not a token the file also uses elsewhere.
   */
  readonly contains: string;
}

/** `file → contains`, the shape a ledger list reads as. */
export type WitnessList = readonly Witness[];

/** Whether `source` still holds the witness text. A missing file never holds. */
export const witnessHolds = (source: string | undefined, contains: string): boolean =>
  source !== undefined && source.includes(contains);

/**
 * Every file a witness list names, deduplicated. Reading the ledger needs the
 * sources of these files and no others, so this is the read set.
 */
export const witnessFiles = (witnesses: WitnessList): readonly string[] => [
  ...new Set(witnesses.map((witness) => witness.file)),
];

/** `file:contains` — one line per witness, for a report that reads as a ledger. */
export const formatWitness = ({ file, contains }: Witness): string => `${file} — ${contains}`;
