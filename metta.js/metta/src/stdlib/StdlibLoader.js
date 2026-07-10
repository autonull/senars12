import { Logger } from '@senars/core';
import { VirtualFS } from '../platform/browser/VirtualFS.js';
import { getEnvironment } from '../platform/env.js';
import { FileLoader } from '../platform/node/FileLoader.js';

const DEFAULT_MODULES = ['core', 'list', 'match', 'types', 'hof', 'js', 'io', 'memory'];

export class StdlibLoader {
  #loadedModules = new Set();

  constructor(interpreter, options = {}) {
    this.interpreter = interpreter;
    this.options = options;
    this.modules = options.modules ?? DEFAULT_MODULES;
    this.adapter = this._createAdapter(options);
  }

  _createAdapter(options) {
    if (options.adapter) {
      return options.adapter;
    }
    const env = getEnvironment();
    if (env === 'node') {
      return new FileLoader({ baseDir: options.stdlibDir, searchPaths: options.searchPaths });
    }
    if (env === 'browser' || env === 'worker') {
      return new VirtualFS({ files: options.virtualFiles ?? {} });
    }
    throw new Error(`Unsupported environment: ${env}`);
  }

  load() {
    const stats = { loaded: [], failed: [], atomsAdded: 0 };
    for (const mod of this.modules) {
      try {
        const res = this.loadModule(mod);
        stats.loaded.push(mod);
        stats.atomsAdded += res.atomCount;
        this.#loadedModules.add(mod);
      } catch (err) {
        throw new Error(`Stdlib module '${mod}' failed to load: ${err.message}`);
      }
    }
    return stats;
  }

  loadModule(name) {
    const fileName = `${name}.metta`;
    if (!this.adapter.exists(fileName)) {
      throw new Error(`Module '${name}' not found`);
    }

    const content = this.adapter.read(fileName);
    const sizeBefore = this.interpreter.space?.size?.() ?? 0;
    this.interpreter.load(content);
    return { module: name, atomCount: (this.interpreter.space?.size?.() ?? 0) - sizeBefore };
  }

  getLoadedModules() {
    return [...this.#loadedModules];
  }

  reload() {
    this.#loadedModules.clear();
    return this.load();
  }
}

export const loadStdlib = (interpreter, options) => new StdlibLoader(interpreter, options).load();
