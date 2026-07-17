export class PersistentSpace {
    id;
    _atoms = [];
    opts;
    saveTimer;
    constructor(id, opts) {
        this.id = id;
        this.opts = { autoSave: true, saveInterval: 5000, ...opts };
    }
    async load() {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const file = path.join(this.opts.storageDir, `${this.id}.metta.json`);
        try {
            const data = await fs.readFile(file, 'utf-8');
            const parsed = JSON.parse(data);
            this._atoms.push(...parsed.atoms);
        }
        catch {
            return;
        }
    }
    async persist() {
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const file = path.join(this.opts.storageDir, `${this.id}.metta.json`);
        const data = {
            id: this.id,
            atoms: this._atoms,
            timestamp: Date.now(),
        };
        await fs.mkdir(this.opts.storageDir, { recursive: true });
        await fs.writeFile(file, JSON.stringify(data, null, 2));
    }
    add(atom) {
        this._atoms.push(atom);
        if (this.opts.autoSave && !this.saveTimer) {
            this.saveTimer = setInterval(async () => {
                await this.persist();
            }, this.opts.saveInterval);
        }
    }
    remove(atom) {
        const index = this._atoms.indexOf(atom);
        if (index === -1)
            return false;
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
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = undefined;
        }
    }
}
function matches(atom, pattern) {
    if (pattern.kind === 1)
        return true;
    if (atom.kind !== pattern.kind)
        return false;
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
            if (!matches(a.operator, p.operator))
                return false;
            if (a.args.length !== p.args.length)
                return false;
            for (let i = 0; i < a.args.length; i++) {
                if (!matches(a.args[i], p.args[i]))
                    return false;
            }
            return true;
        }
        case 5: {
            const a = atom;
            const p = pattern;
            if (a.op !== p.op)
                return false;
            if (a.args.length !== p.args.length)
                return false;
            for (let i = 0; i < a.args.length; i++) {
                if (!matches(a.args[i], p.args[i]))
                    return false;
            }
            return true;
        }
        default:
            return true;
    }
}
//# sourceMappingURL=persistent-space.js.map