export class ConceptBag {
  #concepts = new Map();
  getOrCreate(term) {
    const existing = this.#concepts.get(term);
    if (existing) return existing;
    const created = new Concept(term);
    this.#concepts.set(term, created);
    return created;
  }
  has(term) {
    return this.#concepts.has(term);
  }
  get size() {
    return this.#concepts.size;
  }
}
export class Concept {
  term;
  constructor(term) {
    this.term = term;
  }
}
//# sourceMappingURL=concept-bag.js.map
