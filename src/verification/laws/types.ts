/** Law verification result. */
export interface LawResult {
  /** Law name. */
  law: string;
  /** Whether the law holds. */
  holds: boolean;
  /** Counterexample if law fails. */
  counterexample?: unknown;
  /** Description of the law. */
  description: string;
  /** Severity if violated. */
  severity: 'critical' | 'major' | 'minor';
}