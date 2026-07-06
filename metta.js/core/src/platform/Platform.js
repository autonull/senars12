/**
 * Platform abstraction interface
 * Defines the contract for platform-specific capabilities
 */
export class Platform {
    constructor() {
        if (new.target === Platform) {
            throw new Error('Platform is an abstract class and cannot be instantiated directly');
        }
    }

    /**
     * Get the name of the current platform
     * @returns {string} 'node' or 'browser'
     */
    get name() {
        throw new Error('Not implemented');
    }

    /**
     * File system capabilities
     */
    get fs() {
        throw new Error('Not implemented');
    }

    /**
     * Path manipulation capabilities
     */
    get path() {
        throw new Error('Not implemented');
    }

    /**
     * Check if running in a test environment
     * @returns {boolean}
     */
    isTestEnv() {
        throw new Error('Not implemented');
    }
}
