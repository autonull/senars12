/**
 * VirtualFS.js - Browser Virtual File System
 * In-memory file system for browser environments
 */

import {ENV} from '../env.js';

export class VirtualFS {
    constructor(options = {}) {
        if (!ENV.isBrowser && !ENV.isWorker && ENV.isNode) {
            console.warn('VirtualFS is designed for browser/worker environments');
        }

        this.files = new Map();
        this.directories = new Set();

        // Pre-load files if provided
        if (options.files) {
            Object.entries(options.files).forEach(([name, content]) => {
                this.write(name, content);
            });
        }
    }

    /**
     * Check if file exists
     */
    exists(fileName) {
        return this.files.has(fileName);
    }

    /**
     * Read file content
     */
    read(fileName) {
        if (!this.files.has(fileName)) {
            throw new Error(`File '${fileName}' not found in virtual file system`);
        }
        return this.files.get(fileName);
    }

    /**
     * Write file content
     */
    write(fileName, content) {
        this.files.set(fileName, content);

        // Track directory
        const dirName = fileName.includes('/')
            ? fileName.substring(0, fileName.lastIndexOf('/'))
            : '.';
        this.directories.add(dirName);
    }

    /**
     * List files in directory
     */
    list(dirName = '.') {
        const prefix = dirName === '.' ? '' : `${dirName}/`;
        return Array.from(this.files.keys())
            .filter(name => {
                if (dirName === '.') {
                    return !name.includes('/');
                }
                return name.startsWith(prefix) &&
                    !name.substring(prefix.length).includes('/');
            })
            .map(name => dirName === '.' ? name : name.substring(prefix.length));
    }

    /**
     * Delete file
     */
    delete(fileName) {
        return this.files.delete(fileName);
    }

    /**
     * Clear all files
     */
    clear() {
        this.files.clear();
        this.directories.clear();
    }

    /**
     * Get all files as object
     */
    toObject() {
        return Object.fromEntries(this.files);
    }
}
