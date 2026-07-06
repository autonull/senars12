/**
 * Environment detection utility for SeNARS
 */
export class EnvironmentDetector {
    #cache = new Map();

    isTest() {
        return this.#cached('test', () => {
            if (typeof process !== 'undefined') {
                if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined || process.env.VITEST === 'true') {
                    return true;
                }
            }
            const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};
            return !!(g.__JEST__ || g.__VITEST__);
        });
    }

    isDevelopment() {
        return this.#cached('development', () => typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
    }

    isProduction() {
        return this.#cached('production', () => typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
    }

    isNode() {
        return this.#cached('node', () => typeof process !== 'undefined' && process.versions?.node != null);
    }

    isBrowser() {
        return this.#cached('browser', () => typeof window !== 'undefined' && typeof document !== 'undefined');
    }

    isDebug() {
        return this.#cached('debug', () => {
            const d = process.env?.DEBUG;
            return d === 'true' || d === '1' || process.env?.DEBUG_SENARS === 'true';
        });
    }

    isCI() {
        return this.#cached('ci', () => {
            const e = process.env;
            return e?.CI === 'true' || e?.GITHUB_ACTIONS === 'true' || e?.GITLAB_CI === 'true' || e?.CIRCLECI === 'true';
        });
    }

    getEnvironment() {
        if (this.isTest()) {
            return 'test';
        }
        if (this.isDevelopment()) {
            return 'development';
        }
        if (this.isProduction()) {
            return 'production';
        }
        return 'unknown';
    }

    getInfo() {
        return {
            environment: this.getEnvironment(),
            isTest: this.isTest(),
            isDevelopment: this.isDevelopment(),
            isProduction: this.isProduction(),
            isNode: this.isNode(),
            isBrowser: this.isBrowser(),
            isDebug: this.isDebug(),
            isCI: this.isCI()
        };
    }

    clearCache() {
        this.#cache.clear();
    }

    #cached(key, detector) {
        if (!this.#cache.has(key)) {
            this.#cache.set(key, detector());
        }
        return this.#cache.get(key);
    }
}

export const envDetector = new EnvironmentDetector();
export const isNodeEnvironment = () => envDetector.isNode();
export const isBrowserEnvironment = () => envDetector.isBrowser();
