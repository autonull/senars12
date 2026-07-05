/**
 * ReactiveSpace.js - Observable atomspace with event-driven capabilities
 * Extends Space.js to provide reactive programming patterns for MeTTa
 * Following AGENTS.md: Elegant, Consolidated, Consistent, Organized
 */

import {Space} from '../kernel/Space.js';
import {Unify} from '../kernel/Unify.js';
import {Logger} from '@senars/core';

export class ReactiveSpace extends Space {
    constructor() {
        super();
        this.observers = new Map();
        this.eventLog = [];
        this.maxEventLogSize = 10000;
        this.nextObserverId = 0;
    }

    /**
     * Add an atom to the space and emit event
     */
    add(atom) {
        // Phase P4-B: Stub for vector clock updates
        // atom.vectorClock = this.nextVectorClock();
        super.add(atom);
        this._emit('add', atom);
        return this;
    }

    /**
     * Merge parameters (Phase P4-B Stub)
     */
    _mergeParams(p1, p2) {
        // stub for tensor param merge
    }

    /**
     * Add a rule to the space and emit event
     */
    addRule(pattern, result) {
        super.addRule(pattern, result);
        this._emit('addRule', {pattern, result});
        return this;
    }

    /**
     * Remove an atom from the space and emit event
     */
    remove(atom) {
        const removed = super.remove(atom);
        if (removed) {
            this._emit('remove', atom);
        }
        return removed;
    }

    /**
     * Observe changes matching a pattern
     * @param {*} pattern - Pattern to match against events
     * @param {Function} callback - Callback function(event)
     * @returns {Function} Unsubscribe function
     */
    observe(pattern, callback) {
        const id = this.nextObserverId++;
        const key = pattern.toString();

        if (!this.observers.has(key)) {
            this.observers.set(key, []);
        }

        this.observers.get(key).push({id, pattern, callback});

        // Return unsubscribe function
        return () => this._unobserve(key, id);
    }

    /**
     * Get event log entries since a timestamp
     * @param {number} since - Timestamp (milliseconds)
     * @returns {Array} Event log entries
     */
    getEventLog(since = 0) {
        return this.eventLog.filter(e => e.timestamp > since);
    }

    /**
     * Clear the event log
     */
    clearEventLog() {
        this.eventLog = [];
    }

    /**
     * Clear all observers
     */
    clearObservers() {
        this.observers.clear();
    }

    /**
     * Get observer count
     */
    getObserverCount() {
        return Array.from(this.observers.values())
            .reduce((count, observers) => count + observers.length, 0);
    }

    // === Private Methods ===

    /**
     * Emit an event to matching observers
     */
    _emit(event, data) {
        const entry = {
            event,
            data,
            timestamp: Date.now()
        };

        // Add to event log
        this.eventLog.push(entry);
        if (this.eventLog.length > this.maxEventLogSize) {
            this.eventLog.shift();
        }

        // Notify observers
        for (const [_, observers] of this.observers) {
            for (const {pattern, callback} of observers) {
                if (this._matchesPattern(pattern, data)) {
                    try {
                        callback(entry);
                    } catch (e) {
                        Logger.error('Observer error:', e);
                    }
                }
            }
        }
    }

    /**
     * Check if data matches a pattern
     */
    _matchesPattern(pattern, data) {
        // If data is an object with pattern/result (like addRule event), match against the pattern
        const target = (data && data.pattern && data.result) ? data.pattern : data;

        // Try unification for structured matching
        try {
            return Unify.unify(pattern, target) !== null;
        } catch {
            // Fallback to simple equality
            return pattern === target || pattern.equals?.(target);
        }
    }

    /**
     * Unsubscribe an observer
     */
    _unobserve(key, id) {
        const observers = this.observers.get(key);
        if (observers) {
            const filtered = observers.filter(o => o.id !== id);
            filtered.length === 0
                ? this.observers.delete(key)
                : this.observers.set(key, filtered);
        }
    }
}
