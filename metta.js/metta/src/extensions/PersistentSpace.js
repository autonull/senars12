import {Space} from '../kernel/Space.js';
import {exp, isExpression, sym} from '../kernel/Term.js';
import {Logger} from '@senars/core';
import fs from 'fs';
import path from 'path';

/**
 * PersistentSpace.js - MORK-parity Phase P2-B: Scalable Persistence
 * IndexedDB (browser) or fs (Node.js), Merkle hash integrity, CRDT vector clocks
 */

export class PersistentSpace extends Space {
    constructor(name, opts = {}) {
        super();
        this.dbName = name || 'metta-space';
        this.checkpointThreshold = opts.checkpointThreshold ?? 50000;
        this._pendingWrites = 0;
        this._vectorClocks = new Map();
        this._atomIds = new Map();
        this._nextAtomId = 1;
        this._checkpointInProgress = false;
        this._pendingCheckpoint = false;
        this._storage = this._initStorage();
    }

    _initStorage() {
        if (typeof window !== 'undefined' && window.indexedDB) {
            return new IndexedDBStorage(this.dbName);
        }
        if (typeof process !== 'undefined' && process.versions?.node) {
            return new NodeFSStorage(this.dbName);
        }
        return new MemoryStorage();
    }

    _getAtomId(atom) {
        if (!this._atomIds.has(atom)) {
            this._atomIds.set(atom, this._nextAtomId++);
        }
        return this._atomIds.get(atom);
    }

    _getAtomById(id) {
        for (const [atom, atomId] of this._atomIds.entries()) {
            if (atomId === id) {
                return atom;
            }
        }
        return null;
    }

    add(atom) {
        super.add(atom);
        this._pendingWrites++;
        const atomId = this._getAtomId(atom);
        if (!this._vectorClocks.has(atomId)) {
            this._vectorClocks.set(atomId, new Int32Array(32));
        }
        this._vectorClocks.get(atomId)[0]++;
        if (this._pendingWrites >= this.checkpointThreshold) {
            this._scheduleCheckpoint();
        }
        return this;
    }

    _scheduleCheckpoint() {
        if (this._checkpointInProgress) {
            this._pendingCheckpoint = true;
            return;
        }
        queueMicrotask(() => this._checkpoint());
    }

    async _checkpoint() {
        if (this._checkpointInProgress) {
            return;
        }
        this._checkpointInProgress = true;
        try {
            const serialized = this._serialize();
            const merkleHash = await this._computeMerkleHash(serialized);
            await this._storage.write({
                atoms: serialized,
                merkleHash,
                vectorClocks: this._serializeVectorClocks(),
                timestamp: Date.now(),
                atomCount: this.atoms.size
            });
            this._pendingWrites = 0;
        } catch (e) {
            Logger.error('Checkpoint failed:', e);
        } finally {
            this._checkpointInProgress = false;
            if (this._pendingCheckpoint) {
                this._pendingCheckpoint = false;
                queueMicrotask(() => this._checkpoint());
            }
        }
    }

    _serialize() {
        const atoms = Array.from(this.atoms);
        const serializedAtoms = atoms.map(a => this._serializeAtom(a));
        let totalSize = 4;
        serializedAtoms.forEach(sa => totalSize += 8 + sa.length);

        const buffer = new Uint8Array(totalSize);
        const view = new DataView(buffer.buffer);
        let offset = 0;

        view.setUint32(offset, atoms.length, true);
        offset += 4;

        atoms.forEach((atom, i) => {
            view.setUint32(offset, this._getAtomId(atom), true);
            offset += 4;
            view.setUint32(offset, serializedAtoms[i].length, true);
            offset += 4;
            buffer.set(serializedAtoms[i], offset);
            offset += serializedAtoms[i].length;
        });

        return buffer;
    }

    _serializeAtom(atom) {
        const parts = [];
        if (!atom) {
            parts.push(0xf6);
        } else if (typeof atom === 'string') {
            const encoder = new TextEncoder();
            parts.push(0x7f, ...encoder.encode(atom), 0xff);
        } else if (typeof atom === 'number') {
            const buffer = new ArrayBuffer(9);
            const view = new DataView(buffer);
            view.setUint8(0, 0xfb);
            view.setFloat64(1, atom, true);
            parts.push(...new Uint8Array(buffer));
        } else if (atom.name !== undefined && !atom.components) {
            const encoder = new TextEncoder();
            parts.push(0x7f, ...encoder.encode(`SYM:${atom.name}`), 0xff);
        } else if (isExpression(atom)) {
            const opData = this._serializeAtom(atom.operator);
            const compsData = (atom.components || []).map(c => this._serializeAtom(c));
            parts.push(0x9f, ...opData, ...compsData.flatMap(d => d), 0xff);
        } else {
            parts.push(0xf8, 0xff);
        }
        return new Uint8Array(parts);
    }

    _deserialize(buffer) {
        const view = new DataView(buffer.buffer);
        let offset = 0;
        const atomCount = view.getUint32(offset, true);
        offset += 4;
        const atoms = [];

        for (let i = 0; i < atomCount; i++) {
            const atomId = view.getUint32(offset, true);
            offset += 4;
            const dataLen = view.getUint32(offset, true);
            offset += 4;
            const atom = this._deserializeAtom(buffer.slice(offset, offset + dataLen));
            if (atom) {
                atoms.push(atom);
                this._atomIds.set(atom, atomId);
            }
            offset += dataLen;
        }
        return atoms;
    }

    _deserializeAtom(data) {
        if (data.length === 0) {
            return null;
        }
        const first = data[0];

        if (first === 0xf6) {
            return null;
        }
        if (first === 0xf8) {
            return sym('unknown');
        }

        if (first === 0x7f) {
            const bytes = [];
            let i = 1;
            while (i < data.length && data[i] !== 0xff) {
                bytes.push(data[i++]);
            }
            const str = new TextDecoder().decode(new Uint8Array(bytes));
            return sym(str.startsWith('SYM:') ? str.slice(4) : str);
        }

        if (first === 0xfb) {
            const view = new DataView(data.buffer, data.byteOffset + 1);
            return sym(String(view.getFloat64(0, true)));
        }

        if (first === 0x9f) {
            let i = 1;
            const opEnd = this._findAtomEnd(data, i);
            const op = this._deserializeAtom(data.slice(i, opEnd));
            i = opEnd;
            const components = [];
            while (i < data.length && data[i] !== 0xff) {
                const elemEnd = this._findAtomEnd(data, i);
                components.push(this._deserializeAtom(data.slice(i, elemEnd)));
                i = elemEnd;
            }
            return exp(op, components);
        }
        return sym('unknown');
    }

    _findAtomEnd(data, start) {
        const first = data[start];
        if (first === 0xf6 || first === 0xf8) {
            return start + 1;
        }
        if (first === 0xfb) {
            return start + 9;
        }
        if (first === 0x7f) {
            for (let i = start + 1; i < data.length; i++) {
                if (data[i] === 0xff) {
                    return i + 1;
                }
            }
            return data.length;
        }
        if (first === 0x9f) {
            let depth = 1, i = start + 1;
            while (i < data.length && depth > 0) {
                if (data[i] === 0x9f) {
                    depth++;
                } else if (data[i] === 0xff) {
                    depth--;
                } else if (data[i] === 0x7f) {
                    i = this._findAtomEnd(data, i);
                } else if (data[i] === 0xfb) {
                    i += 8;
                }
                i++;
            }
            return i;
        }
        return start + 1;
    }

    _serializeVectorClocks() {
        return [...this._vectorClocks.entries()].map(([atomId, clock]) => ({atomId, clock: Array.from(clock)}));
    }

    _deserializeVectorClocks(entries) {
        entries.forEach(({atomId, clock}) => this._vectorClocks.set(atomId, new Int32Array(clock)));
    }

    async _computeMerkleHash(data) {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        if (typeof require !== 'undefined') {
            const nodeCrypto = await import('crypto');
            const hash = nodeCrypto.createHash('sha256');
            hash.update(Buffer.from(data.buffer));
            return hash.digest('hex');
        }
        let checksum = 0;
        for (const byte of data) {
            checksum = ((checksum << 5) - checksum + byte) | 0;
        }
        return checksum.toString(16);
    }

    async restore(dbName) {
        try {
            const data = await this._storage.read();
            if (!data?.atoms) {
                return false;
            }
            const computedHash = await this._computeMerkleHash(data.atoms);
            if (computedHash !== data.merkleHash) {
                Logger.warn('Merkle hash mismatch');
            }
            const atoms = this._deserialize(data.atoms);
            this.clear();
            atoms.forEach(atom => this.atoms.add(atom));
            if (data.vectorClocks) {
                this._deserializeVectorClocks(data.vectorClocks);
            }
            this._pendingWrites = 0;
            return true;
        } catch (e) {
            Logger.error('Restore failed:', e);
            return false;
        }
    }

    merge(otherSpace) {
        if (!(otherSpace instanceof PersistentSpace)) {
            otherSpace.atoms.forEach(atom => this.add(atom));
            return;
        }
        for (const [atomId, otherClock] of otherSpace._vectorClocks.entries()) {
            const localClock = this._vectorClocks.get(atomId);
            if (!localClock) {
                const atom = otherSpace._getAtomById(atomId);
                if (atom) {
                    this.add(atom);
                    this._vectorClocks.set(atomId, new Int32Array(otherClock));
                }
            } else {
                const cmp = this._compareVectorClocks(localClock, otherClock);
                if (cmp === 'other') {
                    const atom = otherSpace._getAtomById(atomId);
                    if (atom) {
                        this.atoms.add(atom);
                        this._vectorClocks.set(atomId, this._mergeVectorClocks(localClock, otherClock));
                    }
                } else if (cmp === 'concurrent') {
                    this._vectorClocks.set(atomId, this._mergeVectorClocks(localClock, otherClock));
                }
            }
        }
    }

    _compareVectorClocks(a, b) {
        let aGreater = false, bGreater = false;
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
            const av = a[i] || 0, bv = b[i] || 0;
            if (av > bv) {
                aGreater = true;
            }
            if (bv > av) {
                bGreater = true;
            }
        }
        if (aGreater && !bGreater) {
            return 'local';
        }
        if (bGreater && !aGreater) {
            return 'other';
        }
        if (!aGreater && !bGreater) {
            return 'equal';
        }
        return 'concurrent';
    }

    _mergeVectorClocks(a, b) {
        const result = new Int32Array(Math.max(a.length, b.length));
        for (let i = 0; i < result.length; i++) {
            result[i] = Math.max(a[i] || 0, b[i] || 0);
        }
        return result;
    }

    getVectorClock(atom) {
        return this._vectorClocks.get(this._getAtomId(atom));
    }

    setVectorClock(atom, clock) {
        this._vectorClocks.set(this._getAtomId(atom), clock instanceof Int32Array ? clock : new Int32Array(clock));
    }

    async forceCheckpoint() {
        await this._checkpoint();
    }

    async getStorageStats() {
        return await this._storage.stats();
    }
}

class IndexedDBStorage {
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null;
    }

    async _open() {
        if (this.db) {
            return this.db;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('space')) {
                    db.createObjectStore('space', {keyPath: 'id'});
                }
            };
            request.onsuccess = e => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async write(data) {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('space', 'readwrite');
            const request = tx.objectStore('space').put({id: 'current', ...data});
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async read() {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const request = db.transaction('space', 'readonly').objectStore('space').get('current');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async stats() {
        const db = await this._open();
        return new Promise((resolve, reject) => {
            const request = db.transaction('space', 'readonly').objectStore('space').count();
            request.onsuccess = () => resolve({records: request.result, type: 'IndexedDB'});
            request.onerror = () => reject(request.error);
        });
    }
}

class NodeFSStorage {
    constructor(dbName) {
        this.dbName = dbName;
        this.fs = fs;
        this.path = path;
        this.filePath = this.path.join(process.cwd(), `${dbName}.morkdb`);
    }

    async write(data) {
        const metadata = {
            merkleHash: data.merkleHash,
            timestamp: data.timestamp,
            atomCount: data.atomCount,
            vectorClocks: data.vectorClocks
        };
        const combined = Buffer.concat([Buffer.from(JSON.stringify(metadata)), Buffer.from('\n---MORKDB---\n'), Buffer.from(data.atoms.buffer)]);
        await this.fs.promises.writeFile(this.filePath, combined);
    }

    async read() {
        try {
            const combined = await this.fs.promises.readFile(this.filePath);
            const parts = combined.toString().split('\n---MORKDB---\n');
            const metadata = JSON.parse(parts[0]);
            return {atoms: new Uint8Array(Buffer.from(parts[1], 'base64')), ...metadata};
        } catch (e) {
            return null;
        }
    }

    async stats() {
        try {
            const stats = await this.fs.promises.stat(this.filePath);
            return {size: stats.size, type: 'Node.js FS', path: this.filePath};
        } catch (e) {
            return {size: 0, type: 'Node.js FS', error: e.message};
        }
    }
}

class MemoryStorage {
    constructor() {
        this.data = null;
    }

    async write(data) {
        this.data = data;
    }

    async read() {
        return this.data;
    }

    async stats() {
        return {type: 'Memory', hasData: !!this.data};
    }
}
