import { assertDefined } from '@senars/util/assert';
import { clamp01 } from '@senars/util/numeric';
import { makeId } from '@senars/util/id';
import { cognitiveBound } from '@senars/config';
import { createParameterTable, ParameterScopeError, } from '../../config/parameter-table';
import { SenarsError } from '../../errors/senars-error';
import { schedulerReward } from '../../focus/scheduler-reward';
import { NoopProposalRouter } from '../../governance/proposal-router-port';
import { MetaGame } from './MetaGame';
/**
 * A self-tunable knob over a canonical `cognitiveBounds` row. The row owns the numbers —
 * the three knobs here that have a bounds row used to restate them, and all three had
 * drifted: self-tuning clamped `maxDerivationsPerStep` at 2000 where the config schema
 * admits 10000, and defaulted it to 100 where the engine defaults to 1000.
 */
const boundKnob = (name, range) => ({
    name,
    min: range.min,
    max: range.max,
    defaultValue: range.default,
});
export class SelfMetaGameImpl extends MetaGame {
    focusBag;
    gameFocuses;
    /** TODO19 F5: system-scoped ParameterTable (the knob store + actuators). */
    parameterTable;
    static knobScope = 'system';
    scheduler = null;
    /** D20 (TODO17b): the governance router that consumes self-improvement proposals. */
    proposalRouter;
    /** Phase C (REFACTOR.todo3 §10a M5): typed contradiction intake counter. */
    #contradictions = 0;
    /** Phase D (REFACTOR.todo2): bounded proposal bag — absent ⇒ arrival-order routing. */
    proposalBag;
    drainBudget;
    gates;
    constructor(config) {
        super(config);
        this.focusBag = config.focusBag;
        this.gameFocuses = config.gameFocuses;
        this.gates = config.gates;
        this.proposalBag = config.proposalBag;
        this.drainBudget = config.drainBudget ?? 4;
        this.proposalRouter = config.proposalRouter ?? new NoopProposalRouter();
        this.parameterTable = createParameterTable();
        // TODO19 F5: knobs are ParameterTable entries (system scope, self-owned);
        // the actuator closures replace the former `applyKnob` switch-case.
        const defaultKnobs = [
            boundKnob('maxDerivationsPerStep', cognitiveBound.range('inference.maxDerivationsPerStep')),
            { name: 'taskDecayRate', min: 0.001, max: 0.1, defaultValue: 0.01 },
            { name: 'conceptDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005 },
            { name: 'focusDecayRate', min: 0.0001, max: 0.05, defaultValue: 0.005 },
            boundKnob('rankingMaxAdmissions', cognitiveBound.range('inference.rankingMaxAdmissions')),
            boundKnob('rankingMinScore', cognitiveBound.range('inference.rankingMinScore')),
        ];
        const actuatorFor = (name) => {
            switch (name) {
                case 'taskDecayRate':
                    return (v) => {
                        for (const focus of this.focusBag.all())
                            focus.tasks.decayRateValue = v;
                    };
                case 'conceptDecayRate':
                    return (v) => {
                        for (const focus of this.focusBag.all())
                            focus.memory.decayRateValue = v;
                    };
                case 'focusDecayRate':
                    return (v) => {
                        this.focusBag.decayRateValue = v;
                    };
                // maxDerivationsPerStep / ranking* are engine-side (CognitiveParameters);
                // registered for tuning surface parity without side effects.
                default:
                    return undefined;
            }
        };
        const allKnobs = [...defaultKnobs, ...(config.knobs ?? [])];
        for (const knob of allKnobs)
            this.parameterTable.register({
                name: knob.name,
                scope: 'system',
                min: knob.min,
                max: knob.max,
                value: knob.defaultValue,
                owner: 'self-meta-game',
                actuate: actuatorFor(knob.name),
            });
    }
    setFocusWeight(focusId, weight) {
        const clampedWeight = clamp01(weight);
        this.focusBag.rebalanceWeights(new Map([[focusId, clampedWeight]]));
    }
    attachScheduler(registry, rewardGate) {
        this.scheduler = { registry, rewardGate };
    }
    recordFocusStepReport(report) {
        super.recordFocusStepReport(report);
        if (!this.scheduler)
            return;
        const reward = schedulerReward(report);
        const check = this.scheduler.rewardGate.process({
            eventId: makeId(),
            rewardSignal: reward,
            rewardType: 'intrinsic',
            targetType: 'policy-weights',
            targetId: report.focusId,
            domain: 'self-scheduler',
        });
        if (!check.accepted)
            return;
        this.scheduler.registry.dispatch({ domain: 'self-scheduler', reward, focusId: report.focusId });
        // D20 (TODO17b): route drained self-improvement proposals through the
        // governance pipeline (RLFP domain split) instead of leaving them queued.
        this.routeProposals();
    }
    /** Route queued proposals through ProposalRouter with real actuators. */
    routeProposals() {
        const autonomy = this.gates.getActionGate().getAutonomyMode();
        const drained = this.scheduler?.rewardGate.drain() ?? [];
        const actuators = {
            applyFocusWeight: (focusId, weight) => this.setFocusWeight(focusId, weight),
            applyKnob: (knob, value) => this.setKnob(knob, value),
        };
        // Phase D (REFACTOR.todo2): opt-in bounded bag drains by priority under
        // pressure; the default path routes in arrival order (parity preserved).
        if (this.proposalBag) {
            for (const proposal of drained)
                this.proposalBag.admit(proposal);
            void this.proposalBag
                .drainIfPressured((proposal) => this.proposalRouter.route(proposal, autonomy, actuators), {
                budget: this.drainBudget,
            })
                .catch(() => { });
            return;
        }
        for (const proposal of drained) {
            this.proposalRouter.route(proposal, autonomy, actuators);
        }
    }
    /**
     * Phase C (REFACTOR.todo3 §10a M5): typed MeTTa/NAL disagreement intake.
     * The meta-game resolution strategy: penalize the disagreeing term's policy
     * signal and count the event (replaces the nar-execution substring-only path).
     */
    handleContradiction(event) {
        this.#contradictions++;
        this.scheduler?.registry.dispatch({
            domain: 'self-scheduler',
            reward: -1,
            focusId: event.term.toString(),
        });
    }
    /** Phase C (REFACTOR.todo3): contradiction intake telemetry. */
    get contradictionCount() {
        return this.#contradictions;
    }
    /** D20 follow-up (TODO17b): live depth of the governance human-review queues. */
    getGovernanceQueues() {
        return {
            validation: this.proposalRouter.getAwaitingValidation().length,
            approval: this.proposalRouter.getAwaitingApproval().length,
        };
    }
    applyProposal(proposal) {
        if (proposal.riskTier !== 'low')
            return {
                applied: false,
                reason: `${proposal.riskTier}-risk ${proposal.kind} cannot apply directly`,
            };
        if (proposal.kind === 'focus-weight' &&
            typeof proposal.payload['focusId'] === 'string' &&
            typeof proposal.payload['weight'] === 'number') {
            this.setFocusWeight(proposal.payload['focusId'], proposal.payload['weight']);
            return { applied: true, reason: 'focus-weight applied (clamped 0..1)' };
        }
        return { applied: false, reason: `No direct applier for ${proposal.kind}` };
    }
    setKnob(knob, value) {
        try {
            this.parameterTable.set(SelfMetaGameImpl.knobScope, knob, value);
        }
        catch (e) {
            if (e instanceof ParameterScopeError)
                throw new SenarsError(e.message.startsWith('unknown parameter') ? `Unknown knob: ${knob}` : e.message, 'CONFIGURATION_ERROR', { knob });
            throw e;
        }
    }
    /** P4 (TODO20): batched knob application — one validation pass, coalesced actuation. */
    setKnobs(knobs) {
        try {
            this.parameterTable.setMany(SelfMetaGameImpl.knobScope, Object.entries(knobs));
        }
        catch (e) {
            if (e instanceof ParameterScopeError)
                throw new SenarsError(e.message.startsWith('unknown parameter') ? `Unknown knob: ${e.parameter}` : e.message, 'CONFIGURATION_ERROR', { parameter: e.parameter });
            throw e;
        }
    }
    disableReflex(focusId, reflexId) {
        const focus = assertDefined(this.gameFocuses.get(focusId), `GameFocus not found: ${focusId}`).getFocus();
        focus.disableReflex(reflexId);
    }
    getKnobValue(knob) {
        return this.parameterTable.get(SelfMetaGameImpl.knobScope, knob);
    }
    getAllKnobs() {
        return this.parameterTable.list(SelfMetaGameImpl.knobScope);
    }
    /** Phase B (REFACTOR.todo1): observe knob writes in the parameter ledger. */
    attachParameterLedger(ledger, writer = 'self-meta-game') {
        this.parameterTable.attachLedger(ledger, writer);
    }
}
export function createSelfMetaGame(config) {
    return new SelfMetaGameImpl(config);
}
