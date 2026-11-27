import { asBeliefTruth } from '@senars/types/truth';
import { BoundedRing, maxBy } from '@senars/util/collections';
import { clampSigned, safeRatio, sumBy } from '@senars/util/numeric';
import { envBool } from '@senars/config';
import { ensureDirSync } from '@senars/util/fs';
import { makeId } from '@senars/util/id';
import { systemClock } from '@senars/util/clock';
import { BaseLedgerEntrySchema, createLedger } from '@senars/util/ledger';
import { z } from 'zod';
import { FOCUS_DEFAULTS } from '../constants';
import { perceptionKey } from '../game/Game';
import { Negotiator, } from '../reflex/Negotiator';
import { recordBagPressure, recordHandover, pressureToNumber } from '../telemetry/index';
import { actionRuleBelief, seedBelief } from './belief-seeding';
import { induceEpisodeSchemas } from './episode-schemas';
import { Focus } from './Focus';
import { outcomeTasks, proposalTasks } from './task';
const GameTraceEntrySchema = BaseLedgerEntrySchema.extend({
    cycle: z.number(),
    legalActions: z.array(z.number()),
    reflexProposal: z.unknown().nullable(),
    nalDerivations: z.array(z.unknown()),
    negotiatedAction: z.unknown(),
    reward: z.number(),
    terminal: z.boolean(),
    focusWeightDelta: z.number(),
});
/** AIKR bound for the unbounded-by-tick focus logs (audit tails stay inspectable). */
const FOCUS_LOG_CAPACITY = 2000;
export class GameFocus {
    focus;
    game;
    negotiator;
    handover;
    cognitive;
    schemaInduction;
    clock;
    panelLog = new BoundedRing(FOCUS_LOG_CAPACITY);
    vetoJustifications = new BoundedRing(FOCUS_LOG_CAPACITY);
    episodeHistory = [];
    promotedSchemas = [];
    handoverCount = 0;
    lastTickHandover = false;
    cycle = 0;
    previousPerception = null;
    // Veto tracking (2C)
    vetoCount = 0;
    vetoDetails = [];
    episodeVetoCounts = [];
    currentEpisodeVetos = 0;
    gates;
    constructor(options) {
        this.gates = options.gateRegistry;
        this.game = options.game;
        this.handover = options.handover;
        this.cognitive = options.cognitive ?? false;
        this.schemaInduction = options.schemaInduction ?? false;
        this.clock = options.focusOptions?.clock ?? systemClock;
        this.focus = new Focus({
            id: options.focusId,
            taskCapacity: options.focusOptions?.taskCapacity ?? FOCUS_DEFAULTS.taskCapacity,
            conceptCapacity: options.focusOptions?.conceptCapacity ?? FOCUS_DEFAULTS.conceptCapacity,
            weight: options.focusOptions?.weight ?? 1.0,
            gateRegistry: this.gates,
            clock: this.clock,
        });
        this.negotiator = new Negotiator({
            nalVetoThreshold: 0.8,
            reflexThreshold: -1,
            ...(options.proposers ? { proposers: options.proposers } : {}),
            ...(options.eventBus ? { eventBus: options.eventBus } : {}),
        });
        this.focus.bindGame(this.game);
        // Sandboxed game worlds: grant the focus's own scope sandbox-execute autonomy
        // and allow its legal actions through the kernel ActionGate. The global
        // autonomy mode and shared allowlist are untouched (A3 scoped gates).
        this.syncScope();
        // Initialize game trace ledger if enabled
        if (this.gameTraceEnabled) {
            try {
                const logDir = 'logs';
                ensureDirSync(logDir);
                this.#gameTraceLedger = createLedger(logDir, GameTraceEntrySchema);
            }
            catch {
                this.gameTraceEnabled = false;
            }
        }
        this.initGameTrace();
    }
    logGameTrace(entry) {
        if (!this.gameTraceEnabled)
            return;
        const ledger = this.#gameTraceLedger;
        if (ledger) {
            ledger.append({ ...entry, at: this.clock() });
        }
    }
    /** Refresh this focus's scoped autonomy + allowlist from the current legal actions. */
    syncScope() {
        const actionGate = this.gates.getActionGate();
        actionGate.removeScope(this.focus.id);
        actionGate.setScopeAutonomy(this.focus.id, 'sandbox-execute');
        for (const a of this.game.legalActions(this.game.state()))
            actionGate.addScopedOperation(this.focus.id, String(a));
    }
    /** Drop this focus's scoped gate entries (lifecycle hygiene, A4). */
    releaseScope() {
        this.gates.getActionGate().removeScope(this.focus.id);
        this.gates.getBudgetGate().releaseScope(this.focus.id);
    }
    bindReflex(reflex) {
        this.focus.bindReflex(reflex);
    }
    /** E7: seed a rule belief `(action ==> consequence)` into the focus's task bag. */
    seedRule(action, consequence, truth, priority) {
        seedBelief(this.focus, actionRuleBelief(action, consequence, truth, priority));
    }
    /** E7: seed a raw Narsese belief (Self-Concept-Vocabulary pattern). */
    seedBelief(belief) {
        seedBelief(this.focus, belief);
    }
    /** E7: per-tick cognition snapshots (cognitive mode only). */
    getPanelLog() {
        return this.panelLog.toArray();
    }
    /** E7: recorder-verifiable justification record for every NAL veto. */
    getVetoJustifications() {
        return this.vetoJustifications.toArray();
    }
    recordPanel(entry) {
        if (this.cognitive)
            this.panelLog.push(entry);
    }
    /** E7: build a DerivationRecord for a veto from the matched NAL derivation. */
    buildVetoJustification(cycle, action, derivation) {
        const premise = derivation.premise ?? action;
        const premiseTruth = asBeliefTruth(derivation.truth);
        const stepId = makeId();
        const derived = {
            frequency: premiseTruth.frequency * premiseTruth.frequency,
            confidence: premiseTruth.confidence * premiseTruth.confidence,
        };
        return {
            derivationId: makeId(),
            taskId: makeId(),
            goalTerm: `veto(${action})`,
            steps: [
                {
                    stepId,
                    ruleId: 'deduction',
                    ruleCategory: 'logic',
                    premises: [premise, premise],
                    conclusion: `veto(${action})`,
                    truth: derived,
                    premiseTruths: [premiseTruth, premiseTruth],
                    evidenceLineage: [],
                    independence: 'independent',
                },
            ],
            finalTruth: derived,
            totalCycles: 0,
            maxDepthReached: 0,
            timestamp: Date.now() + cycle,
            engine: 'nar',
        };
    }
    reflexPrefetchContext = null;
    prefetchCalls = 0;
    /** Wire manifold components so semantic reflexes prefetch at the attend stage (C1). */
    setReflexPrefetchContext(context) {
        this.reflexPrefetchContext = context;
    }
    getPrefetchCallCount() {
        return this.prefetchCalls;
    }
    async prefetchForReflexes(t) {
        if (!this.reflexPrefetchContext)
            return;
        const { manifold, embeddingCache, budget } = this.reflexPrefetchContext;
        const { observation, legalActionStrings: legalActions } = t;
        // One embedding for the whole stage, and only if some reflex asks for one:
        // `observation` is fixed across the loop, so serializing it per reflex wrote
        // the same text under a freshly-allocated string and read back the same
        // pointer every time.
        let embedded;
        const embed = () => (embedded ??= embeddingCache.write(perceptionKey(observation)));
        for (const reflex of this.focus.reflexes) {
            const p = reflex;
            if (typeof p.prefetch === 'function') {
                await p.prefetch(observation.stateId, await embed(), legalActions, manifold, budget, observation);
                this.prefetchCalls++;
            }
        }
    }
    gameTraceEnabled = envBool('SENARS_GAME_TRACE');
    #gameTraceLedger = null;
    initGameTrace() {
        if (!this.gameTraceEnabled)
            return;
        // Ledger is initialized in constructor
    }
    async step(budget) {
        this.cycle++;
        const gate = this.beginTick();
        if (!gate.granted)
            return { focusReport: { terminated: gate.terminationReason }, gameOutcome: null };
        const t = await this.perceiveStage(budget);
        if (!this.proposeStage(t))
            return this.endTick(t);
        this.negotiateStage(t);
        if (!t.yielded)
            this.actStage(t);
        this.learnStage(t);
        return this.endTick(t);
    }
    /** Shared per-tick state threaded through the stage methods (G1). */
    tickState() {
        return {
            focusReport: null,
            reflexProposals: [],
            proposals: [],
            proposalActions: [],
            nalDerivations: [],
            bestReflexProposal: null,
            decision: {
                action: null,
                actionExecuted: null,
                vetoedBy: null,
                confidence: 0,
                source: 'none',
                arbitration: 'nal-veto',
            },
            legalActions: [],
            legalActionStrings: [],
            observation: { stateId: '', features: {} },
            prevWeight: 0,
            deliveringReflexes: new Set(),
            gameOutcome: null,
            yielded: false,
            suppressPanel: false,
            proposed: false,
            perceptionPair: null,
        };
    }
    /** BUDGET: renew the per-focus scope and check the `nal-step` budget. */
    beginTick() {
        // Game loops budget per step (the `step(budget)` contract), not per focus
        // lifetime — renew the scope so long-running training isn't starved.
        this.gates.getBudgetGate().createScope(this.focus.id);
        const budgetCheck = this.gates
            .getBudgetGate()
            .check({ operation: 'nal-step', estimatedCost: 1, scopeId: this.focus.id });
        return budgetCheck.granted
            ? { granted: true }
            : { granted: false, terminationReason: budgetCheck.terminationReason };
    }
    /** PERCEPTION: the Focus step admits game observations as tasks, then ATTEND prefetch (C1). */
    async perceiveStage(budget) {
        const t = this.tickState();
        t.observation = this.game.observe();
        t.legalActions = this.game.legalActions(this.game.state());
        t.legalActionStrings = t.legalActions.map(String);
        t.focusReport = await this.focus.step(budget);
        await this.attendStage(t);
        return t;
    }
    /** ATTEND: prefetch semantic reflex judgments before the synchronous propose contract (C1). */
    async attendStage(t) {
        await this.prefetchForReflexes(t);
    }
    /** PROPOSAL: collect from every bound reflex and merge best-of (A2). Returns false when no reflex proposed. */
    proposeStage(t) {
        t.reflexProposals = this.focus.reflexes
            .map((reflex) => ({
            reflex,
            proposals: reflex.propose(t.observation, t.legalActionStrings),
        }))
            .filter((entry) => entry.proposals.length > 0);
        if (t.reflexProposals.length === 0)
            return false;
        t.proposed = true;
        // Merge per action as max(value × confidence) with per-reflex provenance;
        // over a single reflex the merge is the identity (behavior unchanged).
        const merged = new Map();
        for (const { proposals } of t.reflexProposals) {
            for (const p of proposals) {
                const incumbent = merged.get(p.action);
                if (!incumbent || p.value * p.confidence > incumbent.value * incumbent.confidence)
                    merged.set(p.action, p);
            }
        }
        t.proposals = [...merged.values()];
        t.proposalActions = t.proposals.map((p) => p.action);
        // Convert proposals to goals and add to focus tasks
        const goals = proposalTasks(t.proposals, this.clock);
        for (const goal of goals) {
            this.focus.tasks.add(goal);
        }
        t.focusReport.projected.actions += goals.length;
        return true;
    }
    /** NEGOTIATION: NAL derivations, resolution, and the E2 handover (may yield the tick). */
    negotiateStage(t) {
        for (const proposal of t.proposals) {
            t.nalDerivations.push(...this.focus.getNALDerivations(proposal.action));
        }
        t.bestReflexProposal = maxBy(t.proposals, (p) => p.value * p.confidence) ?? null;
        const decision = this.negotiator.resolve(t.proposals, t.nalDerivations);
        recordBagPressure('focus.tasks', pressureToNumber(this.focus.tasks.pressure()));
        recordBagPressure('focus.memory', pressureToNumber(this.focus.memory.pressure()));
        // HANDOVER (E2): review-band decisions escalate to the heuristic baseline
        // (PlayJev handover pattern); block band yields the tick (AIKR), never a
        // forced bad move.
        this.lastTickHandover = false;
        t.decision = decision;
        if (this.handover && t.decision.actionExecuted) {
            const band = this.handover.router.route({ top: { p: t.decision.confidence } });
            const reviewAction = this.handover.reviewAction ?? 'escalate-baseline';
            if (band === 'block' || (band === 'review' && reviewAction === 'abstain')) {
                this.recordPanel(this.panelEntry(t, false, 0, false));
                t.yielded = true;
                return;
            }
            if (band === 'review') {
                const baseline = this.handover.baseline(this.game, t.legalActionStrings);
                if (baseline && t.legalActionStrings.includes(baseline)) {
                    t.decision = {
                        ...t.decision,
                        action: baseline,
                        actionExecuted: baseline,
                        vetoedBy: null,
                    };
                    this.handoverCount++;
                    this.lastTickHandover = true;
                    recordHandover();
                }
            }
        }
        // Weight snapshot and the delivering set for learning fan-out.
        t.prevWeight = this.focus.weight;
        t.deliveringReflexes =
            t.decision.action != null
                ? new Set(t.reflexProposals.map((entry) => entry.reflex))
                : new Set();
    }
    /** AUTHORIZE/ACT/VALIDATE: kernel gate → world mutation → reward firewall. */
    actStage(t) {
        if (t.decision.actionExecuted) {
            const auth = this.gates.getActionGate().authorize({
                proposalId: makeId(),
                operation: `game:${this.focus.id}:${t.decision.actionExecuted}`,
                args: {},
            });
            if (!auth.authorized) {
                const learningEvent = this.negotiator.createLearningEvent(this.focus, { ...t.decision, actionExecuted: null, vetoedBy: auth.vetoReason ?? 'kernel-gate' }, {
                    reward: 0,
                    terminal: false,
                    // The gate refused before `game.step`, so the world is the one the
                    // tick opened with — reading it back from the game rebuilt the grid
                    // to produce the value `t.observation` already holds, and the
                    // re-read assigned `previousPerception` its own unchanged value.
                    perception: t.observation,
                    previousPerception: this.previousPerception,
                });
                for (const reflex of t.deliveringReflexes)
                    reflex.learn(learningEvent);
                t.suppressPanel = true;
                return;
            }
            const previousPerception = this.game.observe();
            const action = this.parseAction(t.decision.actionExecuted);
            // Fallback-after-veto (nal arm): the trap was still vetoed — book it.
            if (t.decision.vetoedBy)
                this.trackVeto(t);
            t.gameOutcome = this.game.step(action);
            const nextPerception = this.game.observe();
            this.syncScope();
            t.perceptionPair = { previousPerception, nextPerception };
            // REWARD: epistemic firewall — reward may only tune policy, never truth
            const firewall = this.gates.getRewardGate().process({
                eventId: makeId(),
                rewardSignal: clampSigned(t.gameOutcome.reward),
                rewardType: 'extrinsic',
                targetType: 'policy-weights',
                targetId: this.focus.id,
                domain: 'external-reflex',
            });
            if (!firewall.accepted)
                t.suppressPanel = true;
        }
        else if (t.decision.action) {
            this.trackVeto(t);
        }
    }
    /** LEARN: fan learning events to every proposing reflex; trace + panel close the tick. */
    learnStage(t) {
        if (t.suppressPanel || !t.proposed)
            return;
        if (t.decision.actionExecuted && t.gameOutcome && t.perceptionPair) {
            // REWARD: Convert outcome to beliefs
            const rewardBeliefs = outcomeTasks(t.gameOutcome, this.clock);
            for (const belief of rewardBeliefs) {
                this.focus.tasks.add(belief);
            }
            t.focusReport.projected.rewards += rewardBeliefs.length;
            // LEARNING: every reflex that proposed the executed action learns (A2 fan-out)
            const learningEvent = this.negotiator.createLearningEvent(this.focus, t.decision, {
                reward: t.gameOutcome.reward,
                terminal: t.gameOutcome.terminal,
                perception: t.perceptionPair.nextPerception,
                previousPerception: t.perceptionPair.previousPerception,
            });
            for (const reflex of t.deliveringReflexes)
                reflex.learn(learningEvent);
            this.episodeHistory.push({ action: t.decision.action, reward: t.gameOutcome.reward });
            this.logGameTrace({
                cycle: this.cycle,
                legalActions: t.legalActions,
                reflexProposal: t.bestReflexProposal,
                nalDerivations: t.nalDerivations,
                negotiatedAction: t.decision,
                reward: t.gameOutcome.reward,
                terminal: t.gameOutcome.terminal,
                focusWeightDelta: this.focus.weight - t.prevWeight,
            });
        }
        else if (t.decision.action) {
            const learningEvent = this.negotiator.createLearningEvent(this.focus, t.decision, {
                reward: 0,
                terminal: false,
                perception: t.perceptionPair?.nextPerception ?? t.observation,
                previousPerception: this.previousPerception,
            });
            for (const reflex of t.deliveringReflexes)
                reflex.learn(learningEvent);
            this.logGameTrace({
                cycle: this.cycle,
                legalActions: t.legalActions,
                reflexProposal: t.bestReflexProposal,
                nalDerivations: t.nalDerivations,
                negotiatedAction: t.decision,
                reward: 0,
                terminal: false,
                focusWeightDelta: this.focus.weight - t.prevWeight,
            });
        }
    }
    /** G2: promote the episode's worst/best action patterns into advisory beliefs. */
    consolidateEpisode() {
        if (!this.schemaInduction) {
            this.episodeHistory = [];
            return;
        }
        const schemas = induceEpisodeSchemas(this.episodeHistory);
        for (const schema of schemas) {
            if (this.promotedSchemas.some((p) => p.action === schema.action && p.kind === schema.kind))
                continue;
            this.promotedSchemas.push(schema);
            this.seedBelief(actionRuleBelief(schema.action, schema.kind === 'bad' ? 'bad_outcome' : 'good_outcome', schema.kind === 'bad' ? { f: 0.1, c: 0.9 } : { f: 0.9, c: 0.9 }));
        }
        this.episodeHistory = [];
    }
    /** G2: schemas promoted so far (advisory beliefs the Negotiator weighs next episode). */
    getPromotedSchemas() {
        return this.promotedSchemas;
    }
    /** Veto bookkeeping (2C) — counters, details, and the E7 justification record. */
    trackVeto(t) {
        this.vetoCount++;
        this.currentEpisodeVetos++;
        const vetoDerivation = t.nalDerivations.find((d) => d.action === t.decision.action && d.truth.f < 0.3 && d.truth.c >= 0.8) ?? t.nalDerivations[0];
        this.vetoDetails.push({
            cycle: this.cycle,
            action: t.decision.action,
            vetoReason: t.decision.vetoedBy ?? 'unknown',
            derivation: vetoDerivation
                ? {
                    action: vetoDerivation.action,
                    truth: vetoDerivation.truth,
                    source: vetoDerivation.source,
                }
                : { action: '', truth: { f: 0, c: 0 }, source: 'none' },
        });
        if (vetoDerivation)
            this.vetoJustifications.push(this.buildVetoJustification(this.cycle, t.decision.action, vetoDerivation));
    }
    panelEntry(t, handover, reward, terminal) {
        return {
            cycle: this.cycle,
            proposalActions: t.proposalActions,
            nalDerivations: t.nalDerivations,
            decision: t.decision,
            handover,
            reward,
            terminal,
            focusWeight: this.focus.weight,
        };
    }
    /** PANEL/consolidate: thought-stream entry + perception advance for completed ticks. */
    endTick(t) {
        if (t.proposed && !t.suppressPanel) {
            this.recordPanel(this.panelEntry(t, this.lastTickHandover, t.gameOutcome?.reward ?? 0, t.gameOutcome?.terminal ?? false));
            this.previousPerception = t.perceptionPair?.nextPerception ?? t.observation;
        }
        return { focusReport: { ...t.focusReport, cycle: this.cycle }, gameOutcome: t.gameOutcome };
    }
    getFocus() {
        return this.focus;
    }
    getGame() {
        return this.game;
    }
    getCycle() {
        return this.cycle;
    }
    /** E2 handover telemetry. */
    getHandoverCount() {
        return this.handoverCount;
    }
    didLastTickHandover() {
        return this.lastTickHandover;
    }
    /** Call at the end of each episode to track veto rate (2C). */
    markEpisodeEnd() {
        this.episodeVetoCounts.push(this.currentEpisodeVetos);
        this.currentEpisodeVetos = 0;
        this.consolidateEpisode();
        // Decay epsilon on reflexes
        for (const reflex of this.focus.reflexes) {
            if (typeof reflex.onEpisodeEnd === 'function') {
                reflex.onEpisodeEnd();
            }
        }
    }
    /** Get veto statistics (2C). */
    getVetoStats() {
        const totalEpisodes = this.episodeVetoCounts.length + (this.currentEpisodeVetos > 0 ? 1 : 0);
        const totalVetosInEpisodes = sumBy(this.episodeVetoCounts, (count) => count) + this.currentEpisodeVetos;
        return {
            totalVetos: this.vetoCount,
            episodeVetoCounts: [...this.episodeVetoCounts, this.currentEpisodeVetos].filter((v) => v > 0),
            vetoRate: safeRatio(totalVetosInEpisodes, totalEpisodes),
            vetoDetails: [...this.vetoDetails],
        };
    }
    /** Reset veto tracking for a new run. */
    resetVetoTracking() {
        this.vetoCount = 0;
        this.vetoDetails = [];
        this.episodeVetoCounts = [];
        this.currentEpisodeVetos = 0;
        this.vetoJustifications.clear();
    }
    parseAction(actionStr) {
        // Try to parse as number for GridWorld
        const num = parseInt(actionStr, 10);
        if (!isNaN(num))
            return num;
        // Return as-is for string actions
        return actionStr;
    }
}
export function createGameFocus(options) {
    return new GameFocus(options);
}
