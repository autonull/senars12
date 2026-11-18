/**
 * The weighted running mean, in one place.
 *
 * `prior` is the mean of everything seen so far and `weight` is how much of it
 * still counts. The two policies the repository needs differ only in that
 * number: an exact mean passes the sample index (`weight = n - 1`), a decayed
 * window passes the retained weight (`weight = 9` for the usual 0.1 step).
 */
export const weightedMean = (prior: number, weight: number, value: number): number =>
  weight > 0 ? (prior * weight + value) / (weight + 1) : value;
