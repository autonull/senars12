import type { NAR } from '@senars/nar';

export const BOOTSTRAP_BELIEFS = [
  '<sky --> blue>.',
  '<bird --> animal>.',
  '<robin --> bird>.',
];

export async function bootstrapNAR(nar: NAR): Promise<void> {
  for (const belief of BOOTSTRAP_BELIEFS) {
    await nar.believe(belief);
  }
  // Run a few reasoning cycles to generate edges from bootstrap relations
  await nar.run(3);
}
