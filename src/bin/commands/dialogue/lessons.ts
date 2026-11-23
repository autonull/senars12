/** Show lessons extracted from retrospectives + formalized corrections */

import { cmd } from '../cli';
import type { BotRuntime } from '../context';

export const lessonsCommand = cmd(
  'lessons',
  'Show lessons extracted from retrospectives + formalized corrections',
  (rt: BotRuntime) => async () => {
    const { extractLessons, loadRetrospectives } = await import('../../dialogue/index');
    const retrospectLessons = (await loadRetrospectives(50)).flatMap((r) =>
      extractLessons(r, {
        term: 'dialogue_performance',
        truth: { frequency: 0.9, confidence: 0.6 },
      })
    );
    // Lessons from formalized corrections join the same ingestion path.
    const lessons = [...rt.dialogue.lessons, ...retrospectLessons];
    if (lessons.length === 0) {
      return 'No lessons (require ≥2 supporting turns per retrospective, or formalized corrections).';
    }
    // Ingest as Narsese self-beliefs (seeded truth, no LM) so they answer `.ask`.
    await Promise.all(
      lessons.map((l) =>
        rt.wired.nar
          .input(`<${l.term}>.`, 'belief', {
            f: l.truth.frequency,
            c: l.truth.confidence,
          } as never)
          .catch(() => undefined)
      )
    );
    return lessons
      .map(
        (l) =>
          `  ${l.term} f=${l.truth.frequency} c=${l.truth.confidence} turns=${l.provenance.turnIds.length}`
      )
      .join('\n');
  }
);