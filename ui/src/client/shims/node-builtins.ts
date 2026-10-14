/**
 * Browser shims for `node:*` builtins.
 *
 * The client imports `@senars/util`'s root index for pure helpers (`debounce`,
 * `makeId`, `truncate`, …). That index also re-exports node-only modules
 * (`fs`, `hash`, `paths`), which a production bundle tree-shakes but a dynamic
 * dev server does not — so the browser would hit Vite's throwing
 * `__vite-browser-external` proxy on import. These no-op shims keep module
 * evaluation working; the client never calls the file/hash paths.
 */

// node:path
export const sep = '/';
export const join = (...parts: string[]): string => parts.filter(Boolean).join('/');
export const resolve = (...parts: string[]): string => join(...parts);
export const dirname = (p: string): string => p.replace(/\/[^/]*$/, '') || '.';
export const basename = (p: string, ext?: string): string => {
  const base = p.replace(/.*\//, '');
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
};
export const extname = (p: string): string => {
  const base = p.replace(/.*\//, '');
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i) : '';
};
export const relative = (_from: string, to: string): string => to;
export const isAbsolute = (p: string): boolean => p.startsWith('/');
export const normalize = (p: string): string => p;

// node:fs / node:fs/promises
export const existsSync = (): boolean => false;
export const readFileSync = (): string => '';
export const writeFileSync = (): void => undefined;
export const appendFileSync = (): void => undefined;
export const mkdirSync = (): undefined => undefined;
export const rmSync = (): void => undefined;
export const readdirSync = (): string[] => [];
export const statSync = () => ({ isDirectory: () => false, isFile: () => false, size: 0 });
export const readFile = async (): Promise<string> => '';
export const writeFile = async (): Promise<void> => undefined;
export const appendFile = async (): Promise<void> => undefined;
export const mkdir = async (): Promise<undefined> => undefined;
export const rm = async (): Promise<void> => undefined;
export const readdir = async (): Promise<string[]> => [];
export const stat = async () => ({ isDirectory: () => false, isFile: () => false, size: 0 });

// node:crypto
export const createHash = (): { update(data: string): unknown; digest(encoding?: string): string } => {
  let accumulated = '';
  const hasher = {
    update(data: string) {
      accumulated += data;
      return hasher;
    },
    digest: (): string => accumulated,
  };
  return hasher;
};
export const randomUUID = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const randomBytes = (size: number): Uint8Array => new Uint8Array(size);

// node:util
export const promisify =
  <A extends unknown[], R>(fn: (...args: [...A, (err: unknown, value: R) => void]) => void) =>
  (...args: A): Promise<R> =>
    new Promise<R>((res, rej) => fn(...args, (err, value) => (err ? rej(err) : res(value))));
export const inspect = (value: unknown): string => String(value);
export const format = (...args: unknown[]): string => args.map(String).join(' ');
