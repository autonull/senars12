import {Platform} from './Platform.js';

/**
 * Browser platform implementation
 */
export class PlatformBrowser extends Platform {
    get name() {
        return 'browser';
    }

    get fs() {
        // Minimal FS mock for browser
        const throwNotSupported = () => {
            throw new Error('File system operations not supported in browser');
        };
        return {
            promises: {
                readFile: throwNotSupported,
                writeFile: throwNotSupported,
                stat: throwNotSupported,
                readdir: throwNotSupported
            },
            existsSync: () => false,
            readFileSync: throwNotSupported,
            writeFileSync: throwNotSupported,
            statSync: throwNotSupported
        };
    }

    get path() {
        // Minimal Path implementation for browser
        return {
            join: (...args) => args.join('/'),
            resolve: (...args) => args.join('/'),
            dirname: (p) => p.split('/').slice(0, -1).join('/'),
            basename: (p) => p.split('/').pop(),
            extname: (p) => {
                const parts = p.split('.');
                return parts.length > 1 ? `.${parts.pop()}` : '';
            },
            normalize: (p) => p,
            relative: (from, to) => {
                // Simplified relative path
                return to.startsWith(from) ? to.slice(from.length + 1) : to;
            },
            sep: '/'
        };
    }

    isTestEnv() {
        return (
            (typeof window !== 'undefined' && (window.__JEST__ || window.__VITEST__)) ||
            (typeof globalThis !== 'undefined' && (globalThis.__JEST__ || globalThis.__VITEST__))
        );
    }
}
