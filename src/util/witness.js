import { unique } from './collections';
/** Whether `source` still holds the witness text. A missing file never holds. */
export const witnessHolds = (source, contains) => source !== undefined && source.includes(contains);
/**
 * Every file a witness list names, deduplicated. Reading the ledger needs the
 * sources of these files and no others, so this is the read set.
 */
export const witnessFiles = (witnesses) => unique(witnesses.map((witness) => witness.file));
/** `file:contains` — one line per witness, for a report that reads as a ledger. */
export const formatWitness = ({ file, contains }) => `${file} — ${contains}`;
