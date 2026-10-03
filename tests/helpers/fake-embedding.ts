/**
 * Deterministic text→embedding stub for benches: FNV-1a rolling hash projected
 * into `dimension` coordinates. Same text ⇒ same vector, no model, no I/O.
 */
import { fnv1aCombine } from '@senars/util';

export function fakeEmbeddingGenerator(dimension = 384): {
  generate(text: string): Promise<number[]>;
} {
  return {
    async generate(text: string): Promise<number[]> {
      const vec = new Array<number>(dimension).fill(0);
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h = fnv1aCombine(h, text.charCodeAt(i));
        vec[i % dimension] = ((h >>> 8) % 2000) / 1000 - 1;
      }
      return vec;
    },
  };
}
