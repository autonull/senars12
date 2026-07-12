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
  await nar.run(5);
}
