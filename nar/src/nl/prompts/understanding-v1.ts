import type { TranslationCacheEntry } from '../cache.js';

const NARSESE_GRAMMAR = `Narsese syntax:
  (A --> B) inheritance (most common)
  (A <-> B) similarity
  (A ==> B) implication
  (A =/> B) temporal implication
  (A ,/ B) temporal before
  [property] property declaration
  --(A) negation
  (A --> ?1) question (what)
  (A --> ?1?) yes/no question
  (A --> ?1!) goal
  Truth values: :frequency:confidence (e.g. :0.9:0.8)
  Universal: frequency 1.0, confidence 0.9
  Existential: frequency 0.5, confidence 0.5
  Typical: frequency 0.9, confidence 0.9`;

/** Few-shot anchors: teach formalization, "unless" ambiguity, and goal extraction. */
const SEED_EXAMPLES: TranslationCacheEntry[] = [
  {
    nl: 'Cats are mammals.',
    result: {
      beliefs: [{ narsese: '(cat --> mammal)', truth: { f: 1.0, c: 0.9 } }],
      questions: [],
      goals: [],
      summary: '',
    },
    timestamp: 0,
  },
  {
    nl: 'The server will crash unless the backup generator kicks in.',
    result: {
      beliefs: [
        { narsese: '(no_backup_generator --> server_crash)', truth: { f: 0.9, c: 0.8 } },
        { narsese: '(server_crash --> no_backup_generator)', truth: { f: 0.8, c: 0.7 } },
      ],
      questions: [],
      goals: [],
      summary: '',
    },
    timestamp: 0,
  },
  {
    nl: 'I want the database to be offline for maintenance.',
    result: {
      beliefs: [],
      questions: [],
      goals: ['(database_state --> offline)!'],
      summary: '',
    },
    timestamp: 0,
  },
];
const formatTruth = (t?: { f: number; c: number }): string =>
  t ? ` %${t.f};${t.c}%` : '';

function formatExamples(entries: TranslationCacheEntry[]): string {
  if (entries.length === 0) return '';
  const lines = entries.map((e) => {
    if (typeof e.result === 'string') return `  "${e.nl}" → ${e.result}`;
    const r = e.result;
    const items = [
      ...r.beliefs.map((b) => `(belief) ${b.narsese}${formatTruth(b.truth)}`),
      ...r.questions.map((q) => `(question) ${q}`),
      ...r.goals.map((g) => `(goal) ${g}`),
    ];
    return `  "${e.nl}" → ${items.length ? items.join('; ') : '(no tasks)'}`;
  });
  return `\nExamples (match this format):\n${lines.join('\n')}`;
}

export function buildUnderstandingPrompt(
  nl: string,
  opts: {
    beliefs?: string[];
    recentExamples?: TranslationCacheEntry[];
    lastError?: string | null;
    memorySnapshot?: string;
  } = {}
): string {
  const parts: string[] = [];

  parts.push('You translate natural language into Narsese logic tasks.');
  parts.push('');
  parts.push(NARSESE_GRAMMAR);
  parts.push('');
  parts.push('Output JSON with these arrays:');
  parts.push('  - beliefs: [{narsese, truth?}] for statements to assert');
  parts.push('  - questions: [narsese_string] for questions to ask (end in ?)');
  parts.push('  - goals: [narsese_string] for goals to pursue (end in !)');
  parts.push(
    '  - meta: {detectedIntent, ambiguities?, coreferences?, implicitContext?, driveModulations?}'
  );
  parts.push('    driveModulations: {driveId: amount} e.g. {"curiosity": 0.3, "coherence": -0.2}');
  parts.push('');
  parts.push('Rules:');
  parts.push('  - truth values (f, c) must be numbers between 0 and 1');
  parts.push('  - NEVER return all arrays empty: extract at least one belief, question, or goal');
  parts.push('  - Narsese must be fully parenthesized: (A --> B), never a bare term');
  parts.push('  - Universal ("all") → frequency 1.0, confidence 0.9');
  parts.push('  - Existential ("some") → frequency 0.5, confidence 0.5');
  parts.push('  - Typical statements → frequency 0.9, confidence 0.9');
  parts.push('  - Cap confidence < 1.0 unless explicitly universal');
  parts.push('  - Multiple sentences → multiple entries');
  parts.push(
    '  - Each entry: include sourceText with the exact input substring it came from (verbatim quote)'
  );
  parts.push('  - Ambiguous input → flag in meta.ambiguities');
  parts.push('  - Coreferences ("he", "it", "that") → resolve using context');
  parts.push('  - Detect intent: chat, command, reasoning, or learning');
  parts.push(
    '  - For command intent: include driveModulations to adjust drives (curiosity, social, coherence)'
  );

  if (opts.beliefs?.length) {
    parts.push('\nRelated beliefs in memory:');
    for (const b of opts.beliefs.slice(0, 10)) {
      parts.push(`  ${b}`);
    }
  }

  if (opts.memorySnapshot) {
    parts.push(`\nMemory snapshot:\n${opts.memorySnapshot}`);
  }

  parts.push(formatExamples(opts.recentExamples?.length ? opts.recentExamples : SEED_EXAMPLES));

  if (opts.lastError) {
    parts.push(`\nPrevious attempt failed: ${opts.lastError}. Try a different approach.`);
  }

  parts.push(`\nTranslate this to Narsese tasks:\n"${nl}"`);

  return parts.join('\n');
}
