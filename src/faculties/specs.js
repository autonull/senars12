/**
 * Faculty Specifications — the 20 core faculty definitions.
 *
 * Each faculty is a named capability with a specific input/output contract.
 * Faculties are invoked through the oracle seam for deterministic replay.
 * Spec data is in ./data.ts to keep this file focused on types and logic.
 */
import { NameRegistry } from '../util/registry';
import { CORE_FACULTIES } from './specs/data';
/** Faculty categories. */
export const FACULTY_CATEGORIES = [
    'perception',
    'reasoning',
    'memory',
    'action',
    'learning',
    'communication',
    'planning',
    'evaluation',
    'meta',
    'governance',
];
/** The 20 core faculties (10 original + perceive.formalize + 9 LM roles). */
export const FACULTIES = [
    'grounding',
    'inference',
    'abduction',
    'induction',
    'analogy',
    'revision',
    'planning',
    'evaluation',
    'communication',
    'governance',
    'perceive.formalize',
    'propose.action',
    'propose.hypothesis',
    'propose.repair',
    'propose.plan',
    'propose.skill',
    'retrieve.rerank',
    'judge.rubric',
    'narrate.explain',
    'mirror.postmortem',
    'simulate.scenario',
];
/** Faculty registry. */
export class FacultyRegistry extends NameRegistry {
    fallbacks = new Map();
    constructor() {
        super({ unique: true, duplicateError: (name) => `Faculty ${name} already registered` });
    }
    /** Register a faculty specification. */
    register(spec) {
        super.register(spec);
        if (spec.fallback) {
            this.fallbacks.set(spec.name, spec.fallback);
        }
    }
    /** Get faculties by category. */
    getByCategory(category) {
        return this.getAll().filter(s => s.category === category);
    }
    /** Get enabled faculties. */
    getEnabled() {
        return this.getAll().filter(s => s.enabled);
    }
    /** Get fallback for a faculty. */
    getFallback(name) {
        return this.fallbacks.get(name);
    }
}
/** Create an isolated faculty registry. */
export function createFacultyRegistry() {
    const registry = new FacultyRegistry();
    for (const spec of CORE_FACULTIES) {
        registry.register(spec);
    }
    return registry;
}
/** Global faculty registry (convenience; prefer {@link createFacultyRegistry}). */
export const facultyRegistry = new FacultyRegistry();
/** Register a faculty globally. */
export function registerFaculty(spec) {
    facultyRegistry.register(spec);
}
/** The 20 core faculty specifications, in registration order. */
export { CORE_FACULTIES } from './specs/data';
/** Register all core faculties, into `registry` (global by default). */
export function registerCoreFaculties(registry = facultyRegistry) {
    for (const spec of CORE_FACULTIES)
        registry.register(spec);
}
