export declare class ConceptBag {
  #private;
  getOrCreate(term: string): Concept;
  has(term: string): boolean;
  get size(): number;
}
export declare class Concept {
  readonly term: string;
  constructor(term: string);
}
//# sourceMappingURL=concept-bag.d.ts.map
