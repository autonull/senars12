/**
 * Are the provider-seam declarations true? (TODO29.a §0.6 item 1, §1.3.)
 *
 * The rule is symmetric, and the symmetry is the whole design. Driving a
 * never-resolving provider through a seam tells you whether the seam *blocks*;
 * the declaration says whether it *should*. So:
 *
 * ```text
 * declared bounded, blocks   → a bound is claimed and does not exist
 * declared bounded, free     → the property holds
 * declared unbounded, blocks → the declaration is truthful, and the property
 *                              is known not to hold yet
 * declared unbounded, free   → the probe observed nothing, and a probe that
 *                              observes nothing is a broken instrument
 * ```
 *
 * The last row is why this is a gate rather than a report. A probe that
 * silently reaches no code produces a table of confident zeroes — the failure
 * this repository has already produced twice (§4 rows 7 and 9), and the reason
 * `bench:cycle --selftest` refuses to print unless each hook is *required* to
 * move. A seam declared unbounded that stops blocking means the instrument
 * stopped working, which is indistinguishable from the property being fixed
 * except that nobody changed a line.
 *
 * There is no third state for "not probed". A seam with no probe result is a
 * failure, so the seam list and the probe list cannot drift apart silently.
 */

export interface SeamDeclaration {
  readonly id: string;
  readonly bounded: boolean;
}

export interface SeamProbe {
  readonly id: string;
  /** Whether the probe reached the seam at all. False makes every other answer meaningless. */
  readonly entered: boolean;
  /** Whether the never-resolving provider blocked the consumer. */
  readonly blocks: boolean;
}

export type SeamFailureKind =
  | 'unbounded-claim'
  | 'probe-never-entered'
  | 'probe-observed-nothing'
  | 'unprobed-seam'
  | 'probe-without-seam';

export interface SeamFailure {
  readonly kind: SeamFailureKind;
  readonly seam: string;
  readonly detail: string;
}

export const checkSeams = (
  declarations: readonly SeamDeclaration[],
  probes: readonly SeamProbe[]
): SeamFailure[] => {
  const failures: SeamFailure[] = [];
  const probed = new Map(probes.map((probe) => [probe.id, probe]));

  for (const declaration of declarations) {
    const probe = probed.get(declaration.id);
    if (!probe) {
      failures.push({
        kind: 'unprobed-seam',
        seam: declaration.id,
        detail: 'declared as a cycle-path await but never driven',
      });
      continue;
    }
    if (!probe.entered) {
      failures.push({
        kind: 'probe-never-entered',
        seam: declaration.id,
        detail: 'the probe never reached the await, so it observed nothing about the seam',
      });
      continue;
    }
    if (declaration.bounded && probe.blocks) {
      failures.push({
        kind: 'unbounded-claim',
        seam: declaration.id,
        detail: 'declared bounded, and a never-resolving provider blocked it',
      });
    }
    if (!declaration.bounded && !probe.blocks) {
      failures.push({
        kind: 'probe-observed-nothing',
        seam: declaration.id,
        detail:
          'declared unbounded, but a never-resolving provider did not block it — either the ' +
          'property now holds or the probe reaches no code, and nothing here can tell those apart',
      });
    }
  }

  const declared = new Set(declarations.map((d) => d.id));
  for (const probe of probes) {
    if (!declared.has(probe.id)) {
      failures.push({
        kind: 'probe-without-seam',
        seam: probe.id,
        detail: 'a probe exists for a seam that is not declared',
      });
    }
  }

  return failures;
};
