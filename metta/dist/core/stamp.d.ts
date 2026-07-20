export declare class Stamp {
  #private;
  readonly creationTime: bigint;
  readonly ids: ReadonlySet<number>;
  constructor(ids: Iterable<number>);
  overlaps(other: Stamp): boolean;
  nextStamp(): Stamp;
}
//# sourceMappingURL=stamp.d.ts.map
