/**
 * env.js - Environment Detection
 * Isomorphic environment detection for Node.js, Browser, and Web Workers
 */

export const ENV = {
    // Node.js: process.versions.node is definitive
    isNode: typeof process !== 'undefined' && !!process.versions?.node,
    // Browser: window + document, but NOT if we're in Node.js
    isBrowser: typeof window !== 'undefined' && typeof window.document !== 'undefined' && typeof process === 'undefined',
    // Worker: self + importScripts, but NOT if we're in Node.js
    isWorker: typeof self !== 'undefined' && typeof importScripts === 'function' && typeof process === 'undefined',
    hasIndexedDB: typeof indexedDB !== 'undefined',
    hasWorkers: typeof Worker !== 'undefined',
    hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    hasFileSystem: typeof process !== 'undefined' && !!process.versions?.node
};

/**
 * Get current environment name
 */
export function getEnvironment() {
    if (ENV.isNode) {
        return 'node';
    }
    if (ENV.isWorker) {
        return 'worker';
    }
    if (ENV.isBrowser) {
        return 'browser';
    }
    return 'unknown';
}

/**
 * Assert environment requirement
 */
export function requireEnvironment(env) {
    const current = getEnvironment();
    if (current !== env) {
        throw new Error(`This operation requires ${env} environment, but running in ${current}`);
    }
}
