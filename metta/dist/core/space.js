export class InMemorySpace {
  id;
  _atoms = [];
  constructor(id = 'default') {
    this.id = id;
  }
  add(atom) {
    this._atoms.push(atom);
  }
  remove(atom) {
    const index = this._atoms.indexOf(atom);
    if (index === -1) return false;
    this._atoms.splice(index, 1);
    return true;
  }
  *query(pattern) {
    for (const atom of this._atoms) {
      if (matches(atom, pattern)) {
        yield atom;
      }
    }
  }
  get size() {
    return this._atoms.length;
  }
  get atoms() {
    return this._atoms;
  }
  [Symbol.dispose]() {
    this._atoms.length = 0;
  }
}
function matches(atom, pattern) {
  if (pattern.kind === 1) return true;
  if (atom.kind !== pattern.kind) return false;
  switch (atom.kind) {
    case 0:
      return atom.value === pattern.value;
    case 2:
      return atom.value === pattern.value;
    case 3:
      return atom.value === pattern.value;
    case 4: {
      const a = atom;
      const p = pattern;
      if (!matches(a.operator, p.operator)) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i], p.args[i])) return false;
      }
      return true;
    }
    case 5: {
      const a = atom;
      const p = pattern;
      if (a.op !== p.op) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i], p.args[i])) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
//# sourceMappingURL=space.js.map
