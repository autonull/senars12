/**
 * NAL Standard Library Loader
 * Loads NAL-specific modules from metta/src/nal/stdlib/
 * Separate from general MeTTa stdlib
 */

import {Logger} from '@senars/core';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const NAL_MODULES = ['truth', 'nal', 'budget', 'attention', 'control', 'search', 'learn'];

export class NALStdlibLoader {
    constructor(interpreter, options = {}) {
        this.interpreter = interpreter;
        this.nalStdlibDir = options.nalStdlibDir || '';
        this.modules = options.modules || NAL_MODULES;
        this.virtualFiles = options.virtualFiles || {};
        this.loadedModules = new Set();
    }

    load() {
        const stats = {loaded: [], failed: [], atomsAdded: 0};

        for (const mod of this.modules) {
            try {
                const res = this.loadModule(mod);
                stats.loaded.push(mod);
                stats.atomsAdded += res.atomCount;
                this.loadedModules.add(mod);
            } catch (err) {
                stats.failed.push({module: mod, error: err.message});
                Logger.warn(`Failed to load NAL stdlib module '${mod}':`, err);
            }
        }
        return stats;
    }

    loadModule(name) {
        let content = '';
        const fileName = `${name}.metta`;

        // 1. Try virtual files first (browser-friendly)
        if (this.virtualFiles[fileName]) {
            content = this.virtualFiles[fileName];
        }
        // 2. Fallback to Node.js fs if available
        else if (typeof process !== 'undefined' && process.versions?.node) {
            try {
                const currentDir = path.dirname(fileURLToPath(import.meta.url));
                const nalStdlibDir = this.nalStdlibDir || path.join(currentDir, 'stdlib');
                const filePath = path.join(nalStdlibDir, fileName);

                if (fs.existsSync(filePath)) {
                    content = fs.readFileSync(filePath, 'utf-8');
                } else {
                    throw new Error(`NAL stdlib module not found: ${filePath}`);
                }
            } catch (e) {
                throw new Error(`Failed to load NAL '${name}' from filesystem: ${e.message}`);
            }
        } else {
            throw new Error(`NAL stdlib module '${name}' not found in virtualFiles and filesystem is unavailable.`);
        }

        const countBefore = this.interpreter.space?.size?.() ?? 0;
        this.interpreter.load(content);
        const countAfter = this.interpreter.space?.size?.() ?? 0;

        return {module: name, atomCount: countAfter - countBefore};
    }

    getLoadedModules() {
        return Array.from(this.loadedModules);
    }

    reload() {
        this.loadedModules.clear();
        return this.load();
    }
}

export const loadNALStdlib = (interpreter, options) => new NALStdlibLoader(interpreter, options).load();
