/**
 * FileLoader.js - Node.js File System Adapter
 * Handles file loading in Node.js environment
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {requireEnvironment} from '../env.js';

export class FileLoader {
    constructor(options = {}) {
        requireEnvironment('node');

        this.fs = fs;
        this.path = path;
        this.url = {fileURLToPath};

        this.searchPaths = options.searchPaths || [];
        this.baseDir = options.baseDir || this._getDefaultBaseDir();

        if (!this.searchPaths.includes(this.baseDir)) {
            this.searchPaths.unshift(this.baseDir);
        }
    }

    /**
     * Static helper to load a file directly
     */
    static load(filePath) {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        throw new Error(`File not found: ${filePath}`);
    }

    _getDefaultBaseDir() {
        // Priority: __dirname > fileURLToPath > URL.pathname > process.cwd()
        // In Jest VM, fileURLToPath may throw 'require is not defined'.
        let currentDir;
        if (typeof __dirname !== 'undefined') {
            currentDir = __dirname;
        } else {
            try {
                // May throw in Jest VM
                currentDir = path.dirname(fileURLToPath(import.meta.url));
            } catch {
                // Last resort: resolve relative to process.cwd()
                // This assumes the test is run from the project root
                currentDir = path.join(process.cwd(), 'metta/src/platform/node');
            }
        }
        // Navigate from platform/node/ to stdlib/
        return path.join(currentDir, '../../stdlib');
    }

    /**
     * Check if file exists
     */
    exists(fileName) {
        return this.searchPaths.some(dir =>
            this.fs.existsSync(this.path.join(dir, fileName))
        );
    }

    /**
     * Read file content
     */
    read(fileName) {
        for (const dir of this.searchPaths) {
            const filePath = this.path.join(dir, fileName);
            if (this.fs.existsSync(filePath)) {
                return this.fs.readFileSync(filePath, 'utf-8');
            }
        }
        throw new Error(`File '${fileName}' not found in: ${this.searchPaths.join(', ')}`);
    }

    /**
     * List files in directory
     */
    list(dirName = '.') {
        const results = new Set();
        for (const searchPath of this.searchPaths) {
            const fullPath = this.path.join(searchPath, dirName);
            if (this.fs.existsSync(fullPath) && this.fs.statSync(fullPath).isDirectory()) {
                const files = this.fs.readdirSync(fullPath);
                files.forEach(f => results.add(f));
            }
        }
        return Array.from(results);
    }

    /**
     * Add search path
     */
    addSearchPath(path) {
        if (!this.searchPaths.includes(path)) {
            this.searchPaths.push(path);
        }
    }
}
