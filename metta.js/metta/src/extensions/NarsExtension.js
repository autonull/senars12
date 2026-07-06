/**
 * NarsExtension.js — Neuro-Symbolic Bridge
 * Exposes NARS cognition through MeTTa grounded operations.
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'fs';
import {resolve} from 'path';
import {Logger} from '@senars/core';
import {Term} from '../kernel/Term.js';

export class NarsExtension {
    constructor(interp, agent) {
        this.interp = interp;
        this.agent = agent;
        this.ground = interp.ground;
        this.nar = agent._nar ?? (typeof agent.input === 'function' ? agent : null);
    }

    register() {
        if (!this.nar) {
            Logger.warn('[NarsExtension] NAR instance not available, registering stubs');
            this._registerStubs();
            return;
        }
        this._registerGoalOps();
        this._registerBeliefOps();
        this._registerStateOps();
        this._registerFocusOps();
        this._registerDerivationOps();
        this._registerRevisionOps();
        this._registerStatsOps();
        Logger.info('[NarsExtension] Registered grounded ops');
    }

    _registerStubs() {
        const stub = name => () => Term.grounded(`(${name} :nar-not-available)`);
        ['nar-goals', 'nar-beliefs', 'nar-goal-add', 'nar-goal-complete', 'nar-goal-status',
            'nar-serialize', 'nar-deserialize', 'nar-snapshot', 'nar-snapshot-compare',
            'nar-stamps', 'nar-recent-derivations', 'nar-focus-sets', 'nar-focus-create',
            'nar-focus-switch', 'nar-revision', 'nar-stats', 'nar-latest-session'].forEach(n => {
            this.ground.add(n, stub(n));
        });
    }

    _registerGoalOps() {
        const findGoal = term => this.nar.taskManager.findTasksByType('GOAL').find(g => g.term?.toString?.().includes(term));

        this.ground.add('nar-goals', statusAtom => {
            const status = statusAtom?.name ?? 'all';
            const goals = this.nar.taskManager.findTasksByType('GOAL');
            const filtered = status === 'active'
                ? goals.filter(g => g.budget?.priority >= 0.5)
                : status === 'pending'
                    ? goals.filter(g => g.budget?.priority < 0.5)
                    : goals;
            return Term.grounded(filtered.map(g => this._goalStr(g)).join('\n'));
        });

        this.ground.add('nar-goal-add', (descAtom, priAtom) => {
            const desc = descAtom?.value ?? descAtom?.name ?? String(descAtom ?? '');
            try {
                this.nar.input(`${desc}!`);
                return Term.grounded(`(goal-added "${desc}")`);
            } catch (err) {
                Logger.error('[nar-goal-add]', err);
                return Term.grounded(`(goal-add-error "${err.message}")`);
            }
        });

        this.ground.add('nar-goal-complete', termAtom => {
            const term = termAtom?.value ?? termAtom?.name ?? String(termAtom ?? '');
            const match = findGoal(term);
            if (match) {
                this.nar.taskManager.removeTask(match);
                return Term.grounded(`(goal-removed "${term}")`);
            }
            return Term.grounded(`(goal-not-found "${term}")`);
        });

        this.ground.add('nar-goal-status', termAtom => {
            const term = termAtom?.value ?? termAtom?.name ?? String(termAtom ?? '');
            const match = findGoal(term);
            if (!match) {
                return Term.grounded(`(goal-status :not-found "${term}")`);
            }
            return Term.grounded(`(goal-status :${match.budget?.priority >= 0.5 ? 'active' : 'pending'} "${term}" :priority ${match.budget?.priority?.toFixed(2) ?? '?'})`);
        });
    }

    _registerBeliefOps() {
        this.ground.add('nar-beliefs', queryAtom => {
            const query = queryAtom?.value ?? queryAtom?.name ?? null;
            const beliefs = query ? this.nar.getBeliefs(query) : this.nar.getBeliefs();
            return Term.grounded(beliefs.slice(0, 20).map(b => {
                const term = b.term?.toString?.() ?? String(b);
                const tv = b.truth ? `f:${b.truth.frequency.toFixed(2)} c:${b.truth.confidence.toFixed(2)}` : '';
                return `[${tv}] ${term}`;
            }).join('\n'));
        });
    }

    _registerStateOps() {
        const ensureDir = dir => {
            if (!existsSync(dir)) {
                mkdirSync(dir, {recursive: true});
            }
        };

        this.ground.add('nar-serialize', () => {
            try {
                const state = this.nar.serialize();
                const dir = resolve(process.cwd(), 'memory/sessions');
                ensureDir(dir);
                const path = resolve(dir, `session_${Date.now()}.json`);
                writeFileSync(path, JSON.stringify(state, null, 2));
                return Term.grounded(`(serialized "${path}")`);
            } catch (err) {
                Logger.error('[nar-serialize]', err);
                return Term.grounded(`(serialize-error "${err.message}")`);
            }
        });

        this.ground.add('nar-deserialize', pathAtom => {
            try {
                const path = pathAtom?.value ?? pathAtom?.name;
                if (!path || !existsSync(path)) {
                    return Term.grounded('(deserialize-error "file-not-found")');
                }
                this.nar.deserialize(JSON.parse(readFileSync(path, 'utf8')));
                return Term.grounded('(deserialized ok)');
            } catch (err) {
                Logger.error('[nar-deserialize]', err);
                return Term.grounded(`(deserialize-error "${err.message}")`);
            }
        });

        this.ground.add('nar-latest-session', () => {
            const dir = resolve(process.cwd(), 'memory/sessions');
            if (!existsSync(dir)) {
                return Term.sym('()');
            }
            const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
            return files.length > 0 ? Term.grounded(files.at(-1)) : Term.sym('()');
        });

        this.ground.add('nar-snapshot', labelAtom => {
            const label = labelAtom?.name ?? `snap_${Date.now()}`;
            try {
                const data = {
                    label, timestamp: Date.now(),
                    beliefs: this.nar.getBeliefs().map(b => ({term: b.term?.toString?.(), truth: b.truth})),
                    goals: this.nar.getGoals().map(g => ({term: g.term?.toString?.(), priority: g.budget?.priority}))
                };
                const dir = resolve(process.cwd(), 'memory/snapshots');
                ensureDir(dir);
                const path = resolve(dir, `${label}.json`);
                writeFileSync(path, JSON.stringify(data, null, 2));
                return Term.grounded(`(snapshot "${label}" "${path}")`);
            } catch (err) {
                Logger.error('[nar-snapshot]', err);
                return Term.grounded(`(snapshot-error "${err.message}")`);
            }
        });

        this.ground.add('nar-snapshot-compare', (labelA, labelB, thresholdAtom) => {
            const threshold = parseFloat(thresholdAtom?.value ?? thresholdAtom?.name ?? '0.1') || 0.1;
            try {
                const dir = resolve(process.cwd(), 'memory/snapshots');
                const a = JSON.parse(readFileSync(resolve(dir, `${labelA}.json`), 'utf8'));
                const b = JSON.parse(readFileSync(resolve(dir, `${labelB}.json`), 'utf8'));
                const aMap = new Map(a.beliefs.map(b => [b.term, b.truth]));
                const shifts = b.beliefs.map(belief => {
                    const prev = aMap.get(belief.term);
                    if (!prev) {
                        return null;
                    }
                    const fShift = Math.abs(belief.truth.frequency - prev.frequency);
                    const cShift = Math.abs(belief.truth.confidence - prev.confidence);
                    return (fShift > threshold || cShift > threshold)
                        ? `${belief.term}: f ${prev.frequency.toFixed(2)}→${belief.truth.frequency.toFixed(2)}, c ${prev.confidence.toFixed(2)}→${belief.truth.confidence.toFixed(2)}`
                        : null;
                }).filter(Boolean);
                return Term.grounded(shifts.length ? shifts.join('\n') : '(no-significant-shifts)');
            } catch (err) {
                Logger.error('[nar-snapshot-compare]', err);
                return Term.grounded(`(compare-error "${err.message}")`);
            }
        });
    }

    _registerFocusOps() {
        this.ground.add('nar-focus-sets', () => {
            const stats = this.nar.focus.getStats();
            const sets = Object.entries(stats.focusSets || {}).map(([name, s]) => `${name}: ${s.size ?? '?'} tasks`);
            return Term.grounded(`current: ${stats.currentFocus}\n${sets.join('\n')}`);
        });

        this.ground.add('nar-focus-create', nameAtom => {
            const name = nameAtom?.value ?? nameAtom?.name ?? String(nameAtom ?? '');
            const ok = this.nar.focus.createFocusSet(name);
            return Term.grounded(ok ? `(focus-created "${name}")` : `(focus-create-failed "${name}")`);
        });

        this.ground.add('nar-focus-switch', nameAtom => {
            const name = nameAtom?.value ?? nameAtom?.name ?? String(nameAtom ?? '');
            const ok = this.nar.focus.setFocus(name);
            return Term.grounded(ok ? `(focus-switched "${name}")` : `(focus-switch-failed "${name}")`);
        });
    }

    _registerDerivationOps() {
        this.ground.add('nar-stamps', termAtom => {
            const term = termAtom?.value ?? termAtom?.name ?? String(termAtom ?? '');
            const tasks = this.nar.taskManager.findTasksByTerm(term);
            if (!tasks.length) {
                return Term.grounded(`(no-tasks-for "${term}")`);
            }
            return Term.grounded(tasks.map(t => {
                const s = t.stamp;
                return `id:${s.id} depth:${s.depth} source:${s.source} derivations:[${(s.derivations || []).slice(0, 5).join(',')}]`;
            }).join('\n'));
        });

        this.ground.add('nar-recent-derivations', countAtom => {
            const count = parseInt(countAtom?.value ?? countAtom?.name ?? '5') || 5;
            const recent = this.nar._streamReasoner?.metrics?.recentDerivations ?? [];
            return Term.grounded(recent.slice(-count).map(d => JSON.stringify(d)).join('\n') || '(no-recent-derivations)');
        });
    }

    _registerRevisionOps() {
        this.ground.add('nar-revision', (termAtom, evidenceAtom) => {
            const evidence = evidenceAtom?.value ?? evidenceAtom?.name ?? String(evidenceAtom ?? '');
            try {
                this.nar.input(evidence);
                return Term.grounded(`(revision-input "${termAtom?.value ?? termAtom?.name ?? ''}")`);
            } catch (err) {
                Logger.error('[nar-revision]', err);
                return Term.grounded(`(revision-error "${err.message}")`);
            }
        });
    }

    _registerStatsOps() {
        this.ground.add('nar-stats', () => {
            const stats = this.nar.getStats();
            const goals = this.nar.getGoals();
            const focusStats = this.nar.focus.getStats();
            const parts = [
                stats.memoryStats ? `memory: ${stats.memoryStats.totalConcepts ?? '?'} concepts` : null,
                stats.taskManagerStats ? `tasks: ${stats.taskManagerStats.totalTasksCreated ?? '?'} created` : null,
                `goals: ${goals.length} (${goals.filter(g => g.budget?.priority >= 0.5).length} active)`,
                `focus: ${focusStats.currentFocus} (${Object.keys(focusStats.focusSets || {}).length} sets)`
            ].filter(Boolean);
            return Term.grounded(parts.join('\n'));
        });
    }

    _goalStr(g) {
        const term = g.term?.toString?.() ?? String(g);
        const pri = g.budget?.priority?.toFixed(2) ?? '?';
        return `[${g.budget?.priority >= 0.5 ? 'active' : 'pending'}] ${term} (pri:${pri})`;
    }
}
