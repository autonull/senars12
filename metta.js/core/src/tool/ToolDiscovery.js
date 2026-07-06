export class ToolDiscovery {
    static discover(toolClasses) {
        const discovered = [];
        for (const toolClass of toolClasses) {
            try {
                const metadata = this.#analyze(toolClass);
                if (metadata) {
                    discovered.push(metadata);
                }
            } catch { /* skip invalid tools */
            }
        }
        return discovered;
    }

    static #analyze(toolClass) {
        const instance = typeof toolClass === 'function' ? new toolClass() : toolClass;
        if (!['execute', 'getDescription'].every(m => typeof instance[m] === 'function')) {
            return null;
        }

        const className = toolClass.name ?? 'AnonymousTool';
        const toolId = className.replace(/tool$/i, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        return this.#createMetadata(toolClass, instance, className, toolId);
    }

    static #createMetadata(toolClass, instance, className, toolId) {
        return {
            id: toolId,
            name: className,
            class: toolClass,
            description: instance.getDescription(),
            category: instance.getCategory?.() ?? 'general',
            parameters: instance.getParameterSchema?.() ?? {type: 'object', properties: {}},
            capabilities: instance.getCapabilities?.() ?? [],
            parameterSchema: instance.getParameterSchema?.() ?? null,
            supportsStreaming: typeof instance.stream === 'function',
            supportsValidation: typeof instance.validate === 'function'
        };
    }

    static isToolLike(obj) {
        const hasExecute = typeof obj.prototype?.execute === 'function' || typeof obj.execute === 'function';
        const hasGetDescription = typeof obj.prototype?.getDescription === 'function' || typeof obj.getDescription === 'function';
        return hasExecute && hasGetDescription;
    }
}
