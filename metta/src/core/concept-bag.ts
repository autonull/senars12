export class ConceptBag {
  #concepts = new Map<string, Concept>();

  getOrCreate(term: string): Concept {
    const existing = this.#concepts.get(term);
    if (existing) return existing;

    const created = new Concept(term);
    this.#concepts.set(term, created);
    return created;
  }

  has(term: string): boolean {
    return this.#concepts.has(term);
  }

  get size(): number {
    return this.#concepts.size;
  }
}

export class Concept {
  constructor(readonly term: string) {}
}
