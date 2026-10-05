/**
 * The two intervals every bounded scalar field in the system lives in.
 *
 * A priority, a confidence, an abstention threshold, a risk floor and an agreement rate
 * are all `0..1`, and each of them spelled that out as `z.number().min(0).max(1)` — two
 * dozen times across `util`, `core` and `nar`, in a byte-identical chain. The pair is named
 * here so that a field which needs it cannot forget half of it, and so that a bound which
 * differs (`rewardSignal` is `[-1,1]`) differs *deliberately* instead of by omission.
 */
import { z } from 'zod';

/** `0..1` — a probability, a rate, a priority, a threshold that cannot be negative. */
export const unitInterval = z.number().min(0).max(1);

/**
 * `-1..1` — a reward or a signed score.
 *
 * Not {@link unitInterval} with a wider max: a negative value here is information (a loss,
 * an opposition) and a schema that floored it at zero would report every loss as neutrality.
 */
export const signedUnitInterval = z.number().min(-1).max(1);
