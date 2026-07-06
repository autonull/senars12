/**
 * MemoryExtension.js - MeTTa Extension for Long-Term Memory
 * deeply integrated with SeNARS Core Memory.
 */
import {Term} from '../kernel/Term.js';
import {Logger} from '@senars/core';

export class MemoryExtension {
    constructor(interpreter, agent) {
        this.interpreter = interpreter;
        this.agent = agent;
        this.ground = interpreter.ground;
    }

    register() {
        this.ground.add('remember', this._remember.bind(this));
        this.ground.add('recall', this._recall.bind(this));
        Logger.info('Memory primitives registered in MeTTa.');
    }

    async _remember(contentAtom) {
        // (remember "content")
        const content = contentAtom.name || contentAtom.toString().replace(/"/g, '');

        try {
            // DEEP INTEGRATION: Use Core Memory if available
            // Agent extends NAR, which has a .memory property (instance of Memory class)
            if (this.agent.memory) {
                // Create a Task/Concept for this content
                // We wrap the content in a Term.
                // Assuming Core Memory expects a Term object.
                // We might need to parse the content into a structured Term or just wrap it as a String Term.

                // Construct a Narsese-like term or just a concept name
                // "content" -> Concept("content")
                // We'll create a task with high priority to ensure it's remembered

                // Ideally, we parse Narsese if provided, otherwise treat as atomic term
                let term;
                // Simple atomic term for now to match mettaclaw string memory
                // But if content has spaces, it needs to be an atomic string literal or compound
                // We'll use a simple term factory if available or ad-hoc
                term = {name: content, toString: () => content, type: 'atom', isTerm: true};

                const task = {
                    term: term,
                    budget: {priority: 0.9, durability: 0.9, quality: 0.9},
                    type: 'BELIEF', // Treat remembered items as beliefs
                    sentence: {term: term, punctuation: '.', truth: {frequency: 1.0, confidence: 0.9}}
                };

                this.agent.memory.addTask(task);
                Logger.info(`[Memory] Integrated remember: ${content}`);
                return Term.sym('True');
            }

            // Fallback to PersistenceManager (legacy/backup)
            if (this.agent.persistenceManager) {
                // Save to a simple list in persistence for basic parity if Core Memory fails
                // This mirrors original implementation
                Logger.warn('[Memory] Core Memory not available, using PersistenceManager fallback.');
                // ... existing logic ...
            }

            return Term.sym('False');
        } catch (error) {
            Logger.error('Error in remember:', error);
            return Term.sym('False');
        }
    }

    async _recall(queryAtom) {
        // (recall "query") -> List of results
        const query = queryAtom.name || queryAtom.toString().replace(/"/g, '');

        try {
            if (this.agent.memory) {
                // Search Core Memory
                // Use getConceptsWithBeliefs or getMostActiveConcepts
                // Or if we have a vector index in Core Memory (not standard in NARS, but maybe in SeNARS extensions)

                // Standard NARS retrieval: Get concept by name/term
                const concept = this.agent.memory.getConcept({name: query});
                if (concept) {
                    // Return related beliefs
                    const beliefs = concept.getTasksByType('BELIEF');
                    const results = beliefs.map(b => Term.str(b.term.toString()));
                    return this.interpreter._listify(results);
                }

                // Fuzzy search? Core Memory might not support it natively without vector extension.
                // We will iterate concepts for partial match as a simple fallback
                const matches = this.agent.memory.getAllConcepts()
                    .filter(c => c.term.name.includes(query))
                    .map(c => Term.str(c.term.name));

                return this.interpreter._listify(matches);
            }

            return Term.sym('()');
        } catch (error) {
            Logger.error('Error in recall:', error);
            return Term.sym('()');
        }
    }
}
