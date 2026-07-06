import {Platform} from './Platform.js';
import fs, {promises as fsPromises} from 'fs';
import path from 'path';

/**
 * Node.js platform implementation
 */
export class PlatformNode extends Platform {
    get name() {
        return 'node';
    }

    get fs() {
        return {
            ...fs,
            promises: fsPromises,
            exists: fs.existsSync,
            readFile: fs.readFileSync,
            writeFile: fs.writeFileSync
        };
    }

    get path() {
        return path;
    }

    isTestEnv() {
        return (
            process.env.NODE_ENV === 'test' ||
            process.env.JEST_WORKER_ID !== undefined ||
            process.env.VITEST === 'true'
        );
    }
}
