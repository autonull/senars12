import { getOrInsert } from '@senars/util';

export class ConceptBag {
  #concepts = new Map<string, Concept>();

  get size(): number {
    return this.#concepts.size;
  }

  getOrCreate(term: string): Concept {
    return getOrInsert(this.#concepts, term, () => new Concept(term));
  }

  has(term: string): boolean {
    return this.#concepts.has(term);
  }
}

export class Concept {
  constructor(readonly term: string) {}
}
