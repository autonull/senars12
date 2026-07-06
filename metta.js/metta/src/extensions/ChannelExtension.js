/**
 * ChannelExtension.js - MeTTa Extension for Channel Primitives
 * Bridges the JS EmbodimentBus to MeTTa Atoms.
 *
 * Phase 5: Updated to work with EmbodimentBus instead of ChannelManager
 */
import {Term} from '../kernel/Term.js';
import {Logger} from '@senars/core';

export class ChannelExtension {
    constructor(interpreter, embodimentBus, {channelFactories = {}, toolFactories = {}} = {}) {
        this.interpreter = interpreter;
        this.embodimentBus = embodimentBus;
        this.ground = interpreter.ground;
        this.eventListeners = new Map();
        this.agent = null;
        this.channelFactories = channelFactories;
        this.toolFactories = toolFactories;
    }

    register() {
        this.ground.add('join-embodiment', this._joinEmbodiment.bind(this));
        this.ground.add('leave-embodiment', this._leaveEmbodiment.bind(this));
        this.ground.add('send-message', this._sendMessage.bind(this));
        this.ground.add('web-search', this._webSearch.bind(this));
        this.ground.add('on-event', this._onEvent.bind(this));
        this.ground.add('llm-query', this._llmQuery.bind(this));

        // File Operations (Parity)
        this.ground.add('read-file', this._readFile.bind(this));
        this.ground.add('write-file', this._writeFile.bind(this));

        // Listen to all messages globally to route to specific listeners
        this.embodimentBus.on('message', this._handleGlobalMessage.bind(this));

        Logger.info('Channel primitives registered in MeTTa.');
    }

    async _joinEmbodiment(typeAtom, configAtom) {
        const type = typeAtom.name || typeAtom.toString();
        const config = this._atomToConfig(configAtom);

        Logger.info(`[MeTTa] Joining embodiment: ${type} with config`, config);

        try {
            const EmbodimentClass = this._resolveChannelFactory(type);
            if (!EmbodimentClass) return Term.sym('Error:UnknownEmbodimentType');

            const embodiment = new EmbodimentClass(config);
            this.embodimentBus.register(embodiment);
            await embodiment.connect();

            return Term.sym(embodiment.id);
        } catch (error) {
            Logger.error('Error joining embodiment:', error);
            return Term.sym('Error:JoinFailed');
        }
    }

    _resolveChannelFactory(type) {
        const typeMap = {irc: 'irc', nostr: 'nostr', cli: 'cli'};
        const key = typeMap[type];
        return key ? this.channelFactories[key] : null;
    }

    async _leaveEmbodiment(embodimentIdAtom) {
        const id = embodimentIdAtom.name;
        try {
            await this.embodimentBus.unregister(id);
            return Term.sym('True');
        } catch (error) {
            return Term.sym('False');
        }
    }

    async _sendMessage(embodimentIdAtom, targetAtom, contentAtom) {
        const id = embodimentIdAtom.name;
        const target = targetAtom.name || targetAtom.toString().replace(/"/g, '');
        const content = contentAtom.name || contentAtom.toString().replace(/"/g, '');

        try {
            await this.embodimentBus.sendMessage(id, target, content);
            return Term.sym('True');
        } catch (error) {
            Logger.error(`Failed to send message to ${id}:`, error);
            return Term.sym('False');
        }
    }

    async _webSearch(queryAtom) {
        const query = queryAtom.name || queryAtom.toString().replace(/"/g, '');
        try {
            let tool;
            if (this.agent?.toolInstances?.websearch) {
                tool = this.agent.toolInstances.websearch;
            } else if (this.toolFactories.websearch) {
                const config = this.agent?.config?.tools?.websearch ?? {};
                tool = this.toolFactories.websearch(config);
            } else {
                Logger.warn('Web search requested but no WebSearchTool available. Inject via toolFactories or agent.toolInstances.');
                return Term.sym('()');
            }

            const results = await tool.search(query);

            if (!Array.isArray(results)) {
                if (results?.error) {
                    Logger.warn(`Web search returned error: ${results.error}`);
                }
                return Term.sym('()');
            }

            const listItems = results.map(r =>
                Term.exp(Term.sym(':'), [
                    Term.grounded(r.title),
                    Term.grounded(r.link),
                    Term.grounded(r.snippet)
                ])
            );
            return this.interpreter._listify(listItems);

        } catch (error) {
            Logger.error('Web search failed:', error);
            return Term.sym('()');
        }
    }

    async _llmQuery(promptAtom) {
        // (llm-query "prompt")
        const prompt = promptAtom.name || promptAtom.toString().replace(/"/g, '');

        try {
            if (this.agent && this.agent.ai) {
                const response = await this.agent.ai.generate(prompt);
                return Term.grounded(response.text);
            }
            return Term.grounded("Error: AI Client not available");
        } catch (error) {
            Logger.error('LLM query failed:', error);
            return Term.grounded(`Error: ${error.message}`);
        }
    }

    async _readFile(pathAtom) {
        const filePath = pathAtom.name || pathAtom.toString().replace(/"/g, '');
        try {
            const fileTool = await this._resolveFileTool();
            const content = fileTool.readFile(filePath);
            return content ? Term.grounded(content) : Term.sym('Error:FileNotFound');
        } catch (e) {
            return Term.sym('Error:ReadFailed');
        }
    }

    async _writeFile(pathAtom, contentAtom) {
        const filePath = pathAtom.name || pathAtom.toString().replace(/"/g, '');
        const content = contentAtom.name || contentAtom.toString().replace(/"/g, '');
        try {
            const fileTool = await this._resolveFileTool();
            fileTool.writeFile(filePath, content);
            return Term.sym('True');
        } catch (e) {
            return Term.sym('False');
        }
    }

    async _resolveFileTool() {
        if (this.agent?.toolInstances?.file) return this.agent.toolInstances.file;
        if (this.toolFactories.file) return this.toolFactories.file({workspace: './workspace'});
        Logger.warn('File operation requested but no FileTool available. Inject via toolFactories or agent.toolInstances.');
        throw new Error('FileTool not available');
    }

    _onEvent(channelIdAtom, eventTypeAtom, callbackAtom) {
        // (on-event <channel-id> <event-type> <callback>)
        const channelId = channelIdAtom.name || channelIdAtom.toString().replace(/"/g, '');
        const eventType = eventTypeAtom.name || eventTypeAtom.toString().replace(/"/g, '');

        if (!this.eventListeners.has(channelId)) {
            this.eventListeners.set(channelId, []);
        }

        this.eventListeners.get(channelId).push({
            type: eventType,
            callback: callbackAtom
        });

        Logger.info(`[MeTTa] Registered listener for ${channelId}:${eventType}`);
        return Term.sym('True');
    }

    _handleGlobalMessage(msg) {
        const listeners = this.eventListeners.get(msg.channelId);
        if (!listeners) {
            return;
        }

        const type = msg.metadata?.type || 'message';

        listeners.forEach(listener => {
            if (listener.type === type || listener.type === '*') {
                this._triggerCallback(listener.callback, msg);
            }
        });
    }

    _triggerCallback(callbackAtom, msg) {
        // Prepare arguments for callback: (callback <from> <content>)
        // Construct the expression programmatically to avoid injection risks
        // (<callback> "from" "content")

        const fromAtom = Term.grounded(msg.from);
        const contentAtom = Term.grounded(msg.content);

        // Construct the call expression: (<callback> <from> <content>)
        // We assume callbackAtom is a reference to a function (Lambda or defined op)
        // or a symbol that resolves to one.
        const expr = Term.exp(callbackAtom, [fromAtom, contentAtom]);

        // Execute in interpreter
        // Since we are in an event handler (outside main loop), we need to run this.
        // We use evaluateAsync to run it.
        // Note: This runs in the background. Errors are logged.
        this.interpreter.evaluateAsync(expr)
            .catch(err => Logger.error('Error executing event callback:', err));
    }

    // Helper to convert MeTTa structure to JS Object
    _atomToConfig(atom) {
        const config = {};
        if (atom.type === 'expression' || atom.name === '()') {
            const elements = this.interpreter._flattenToList(atom);
            elements.forEach(pair => {
                if (pair.type === 'expression' && pair.components.length === 2) {
                    const key = pair.components[0].toString().replace(/"/g, '');
                    const val = pair.components[1].toString().replace(/"/g, '');
                    config[key] = val;
                }
            });
        }
        return config;
    }
}
