declare module 'glob' {
  export interface GlobOptions {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nodir?: boolean;
    absolute?: boolean;
    matchBase?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    nosort?: boolean;
    nounique?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: Map<string, unknown>;
    statCache?: Map<string, unknown>;
    symlinks?: Map<string, unknown>;
    ignore?: string | string[];
    follow?: boolean;
    realpath?: boolean;
    maxDepth?: number;
  }

  export function glob(pattern: string | string[], options?: GlobOptions): Promise<string[]>;
  export function globSync(pattern: string | string[], options?: GlobOptions): string[];

  export class Glob {
    constructor(pattern: string | string[], options?: GlobOptions);
    [Symbol.asyncIterator](): AsyncIterableIterator<string>;
    [Symbol.iterator](): IterableIterator<string>;
  }
}