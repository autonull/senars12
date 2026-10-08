/**
 * Unified line diff (§4.3) — the representation behind the `diff` shape and the
 * `config-change` artifact. Pure and deterministic: an LCS table over the two
 * line arrays yields add/del/context runs. Sized for config and comparison
 * payloads, not megabyte files.
 */

import type { DiffLine } from './view-spec.js';

/** Diff two texts line-by-line into a unified add/del/context sequence. */
export function diffLines(before: string, after: string): DiffLine[] {
  const left = before.split('\n');
  const right = after.split('\n');
  const rows = left.length;
  const cols = right.length;

  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0)
  );
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i]![j] =
        left[i] === right[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (left[i] === right[j]) {
      lines.push({ kind: 'context', text: left[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      lines.push({ kind: 'del', text: left[i]! });
      i++;
    } else {
      lines.push({ kind: 'add', text: right[j]! });
      j++;
    }
  }
  while (i < rows) lines.push({ kind: 'del', text: left[i++]! });
  while (j < cols) lines.push({ kind: 'add', text: right[j++]! });
  return lines;
}
