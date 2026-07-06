import {Parser} from '../Parser.js';
import {Space} from './Space.js';
import {ENV} from '../platform/env.js';

export class ModuleLoader {
    constructor(interpreter, basePath = '.') {
        this.interpreter = interpreter;
        this.basePath = basePath;
        this.loadedModules = new Map();
        this.loading = new Set(); // Circular dependency detection
    }

    async import(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        if (this.loading.has(moduleName)) {
            throw new Error(`Circular dependency detected: ${moduleName}`);
        }

        this.loading.add(moduleName);

        try {
            // Create isolated space for module
            const moduleSpace = new Space();
            const content = await this._loadModuleContent(moduleName);

            // Parse and load into module space
            const parser = new Parser();
            const atoms = parser.parseProgram(content);

            // Create sub-interpreter for module (basic version, reusing ground and config)
            atoms.forEach(atom => {
                if (atom.operator?.name === '=' && atom.components?.length === 2) {
                    moduleSpace.addRule(atom.components[0], atom.components[1]);
                } else {
                    moduleSpace.add(atom);
                }
            });

            const moduleData = {
                space: moduleSpace,
                exports: this._extractExports(moduleSpace)
            };

            this.loadedModules.set(moduleName, moduleData);
            return moduleData;
        } finally {
            this.loading.delete(moduleName);
        }
    }

    async include(filePath) {
        const content = await this._loadModuleContent(filePath);
        this.interpreter.load(content);
    }

    _extractExports(space) {
        const exports = {};
        for (const atom of space.all()) {
            if (atom.operator?.name === 'export' && atom.components?.length === 2) {
                exports[atom.components[0].name] = atom.components[1];
            }
        }
        return exports;
    }

    async _loadModuleContent(name) {
        const fileName = name.endsWith('.metta') ? name : `${name}.metta`;

        if (ENV.isNode) {
            try {
                const {FileLoader} = await import('../platform/node/FileLoader.js');
                const path = await import('path');
                // Try direct path first
                const directPath = path.resolve(this.basePath, fileName);
                try {
                    return FileLoader.load(directPath);
                } catch {}
                // Try search paths: examples dir, metta/lib, project root
                const {fileURLToPath} = await import('url');
                const moduleDir = path.dirname(fileURLToPath(import.meta.url));
                const projectRoot = path.resolve(moduleDir, '../..');
                const searchPaths = [
                    path.resolve(projectRoot, 'metta/examples'),
                    path.resolve(projectRoot, 'metta/lib'),
                    path.resolve(projectRoot, 'metta/stdlib'),
                    projectRoot,
                    this.basePath,
                ];
                for (const base of searchPaths) {
                    const candidate = path.resolve(base, fileName);
                    try { return FileLoader.load(candidate); } catch {}
                }
                throw new Error(`File not found: ${fileName} (searched: ${searchPaths.join(', ')})`);
            } catch (e) {
                throw e;
            }
        } else {
            const {VirtualFS} = await import('../platform/browser/VirtualFS.js');
            return VirtualFS.load(`${fileName}`);
        }
    }
}
