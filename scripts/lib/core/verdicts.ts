/**
 * One verdict shape and one terminal block for every gate.
 *
 * Nine gate modules each declared its own finding record — `{id, rule, detail}`,
 * `{at, rule, detail}`, `{ruleId, reason, detail}`, `{kind, subject, detail}` — and
 * each gate script then re-spelled the same exit: an `if (findings.length > 0)`, a
 * `console.error` header, one line per finding, an optional remedy paragraph,
 * `process.exit(1)`, then a `— clean` line. The drift that follows is not dramatic;
 * it is that a gate written next month picks one of the nine shapes and thereby
 * makes "what does a gate finding look like" a question with nine answers.
 *
 * {@link Verdict} is that answer. {@link collector} is the accumulator — and the
 * `unique-id` check that four modules wrote by hand — and {@link report} is the
 * exit. A gate whose findings are genuinely a closed union (`kind:
 * 'unprobed-seam' | …`) keeps that union and passes a renderer: narrowing it to a
 * bare `rule: string` would cost the caller the exhaustiveness `switch` gives.
 */

export interface Verdict {
  /** Where the finding is: a `file:line`, a declaration id, or a subject key. */
  readonly at: string;
  /** The rule the finding breaks — what a test and a CI filter both match on. */
  readonly rule: string;
  /** Why it matters, in a sentence. */
  readonly detail: string;
}

export const collector = () => {
  const verdicts: Verdict[] = [];
  const seen = new Set<string>();
  return {
    /** Everything reported, in report order. */
    verdicts,
    /**
     * The reporter for one subject: `fail(rule, detail)` addressed to it, and the
     * uniqueness check with it. A subject reported twice is itself a `unique-id`
     * finding, because two declarations of one id say the table names one thing
     * twice and a reader cannot tell which is load-bearing.
     */
    for: (at: string): ((rule: string, detail: string) => void) => {
      if (seen.has(at)) verdicts.push({ at, rule: 'unique-id', detail: `${at} is declared twice` });
      seen.add(at);
      return (rule, detail) => void verdicts.push({ at, rule, detail });
    },
    /** Report against a subject that is legitimately reported more than once. */
    fail: (at: string, rule: string, detail: string): void =>
      void verdicts.push({ at, rule, detail }),
  };
};

export interface ReportOptions<T> {
  /** One finding's lines, indented under the header. Defaults to `String(finding)`. */
  readonly lines?: (finding: T) => readonly string[];
  /** Paragraph printed under the findings — how to make this gate pass. */
  readonly remedy?: string;
  /** Printed when the gate passes. Omit where the script states its own summary. */
  readonly clean?: string;
}

/**
 * Print a gate's findings and exit non-zero; print the clean line and return when
 * there are none, so the caller's own summary still runs.
 */
export const report = <T>(
  gate: string,
  findings: readonly T[],
  options: ReportOptions<T> = {}
): void => {
  if (findings.length === 0) {
    if (options.clean) console.log(`\n${gate} — ${options.clean}`);
    return;
  }
  console.error(`\n${gate} — ${findings.length} finding(s)\n`);
  for (const finding of findings) {
    for (const line of options.lines?.(finding) ?? [`${finding}`]) console.error(`  ${line}`);
  }
  if (options.remedy) console.error(`\n${options.remedy}`);
  process.exit(1);
};

/** `[rule] at`, then the detail beneath it. */
export const verdictLines = ({ at, rule, detail }: Verdict): readonly string[] => [
  `[${rule}] ${at}`,
  `  ${detail}`,
];
