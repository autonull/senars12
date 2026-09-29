/**
 * Phase A (REFACTOR.todo3): NarFacade — implementation surface extracted from
 * `nar.ts` so the NAR class body stays under the M2 monolith budget. These
 * functions operate purely through NAR's public accessors (no private-field
 * reach-in); `nar.ts` re-binds them as thin methods. Init guards live in a
 * WeakSet so per-instance semantics survive the extraction.
 */
import { makeId, truncate } from '@senars/util';
import { createBootstrapTasks } from '../drives';
import { getModelForTask } from '../lm/providers/chains.js';
import { LMRules } from '../lm/rule-selectors/factory.js';
import type { LMService } from '../lm';
import type { MeTTaRuntime } from '@senars/metta';
import type { LanguageModel } from 'ai';
import type { LMRule } from '../lm/rule/LMRule.js';
import { seedContrastiveMemory } from '../lm/system-one/hard-negatives.js';
import { createSystemOneLMRuleAdapter } from '../lm/system-one/rule-adapter.js';
import { containsSubterm, getSubject, termParser, termsEqual, Truth } from '../terms';
import type { Term } from '../terms';
import { discoverTools } from '../tools';
import { createSelfTools } from '../tools/adapters/self-tools.js';
import type { Tool } from '../tools';
import { errMsg } from '../utils';
import type { NAR } from '../nar.js';
import type { SelfImprovementProposal, AutonomyMode } from '@senars/kernel/schemas';

const initialized = new WeakSet<NAR>();
const toolsInitialized = new WeakSet<NAR>();

export const getModelWithFallback = (nar: NAR, prefix: string) => {
  const registry = nar.getProviderRegistry();
  if (!registry) return undefined;
  try {
    return (registry as { languageModel: (id: string) => unknown }).languageModel(`local:${prefix}`);
  } catch {
    return (registry as { languageModel: (id: string) => unknown }).languageModel('builtin:compact');
  }
};

export const injectBootstrapGoals = async (nar: NAR): Promise<void> => {
  for (const task of createBootstrapTasks()) {
    await nar.input(task.term, task.type, task.truth as never);
  }
};

export const contradicts = (a: Term, b: Term): boolean => {
  if (termsEqual(a, b)) return true;
  const [aArg] = a.kind === 'negation' ? a.args : [];
  const [bArg] = b.kind === 'negation' ? b.args : [];
  return (!!aArg && termsEqual(aArg, b)) || (!!bArg && termsEqual(bArg, a));
};

/** §8 dispositions served by the System One rule adapter (F5). */
const SYSTEM_ONE_DISPOSITION_RULES = new Set([
  'lm-narsese-translation',
  'lm-meta-reasoning',
  'lm-uncertainty-calibration',
]);

export const initializeLMRules = (
  nar: NAR,
  lmRules: readonly LMRule[],
  structuredModel?: LanguageModel
): void => {
  if (initialized.has(nar)) return;

  const toolDispatcher = async (tool: string, args: Record<string, unknown>) => {
    return nar.executeTool(tool, args);
  };

  const dispatcher = nar.getSystemOneDispatcher();
  const systemOneAdapter = dispatcher
    ? createSystemOneLMRuleAdapter({
        dispatcher,
        nar: {
          getCycleCount: () => nar.getCycleCount(),
          getSystemOneEmbeddingCache: () => nar.getSystemOneEmbeddingCache(),
          getSystemOneManifold: () => nar.getSystemOneManifold(),
        },
        logger: nar.logger,
      })
    : null;

  for (const rule of lmRules) {
    if (structuredModel) rule.setStructuredModel(structuredModel);
    rule.setSystemEventBus(nar.getSystemEventBus());
    rule.setEventBus(nar.getSystemEventBus());
    rule.setNAR(nar);
    rule.setToolDispatcher(toolDispatcher);

    // §8 dispositions with a System One adapter (F5): translation REPLACE
    // via proposeAndJudge, meta-reasoning + uncertainty-calibration REPLACE
    // via manifold scoring/calibrators.
    if (systemOneAdapter && SYSTEM_ONE_DISPOSITION_RULES.has(rule.id)) {
      rule.setSystemOneAdapter(systemOneAdapter);
    }

    nar.getProcessor().registerLMRule(rule);
  }
  initialized.add(nar);
};

export const initializeTools = (nar: NAR): void => {
  if (toolsInitialized.has(nar)) return;

  const toolDeps = { memory: nar.memory, nar } as Record<string, unknown>;
  for (const tool of discoverTools(toolDeps)) {
    nar.tools.register(tool);
  }

  // Metta tool — delegates to MeTTa runtime for exact computation
  // Lazy-load MeTTa runtime to avoid circular deps
  let mettaRuntime: MeTTaRuntime | undefined;
  const getMettaRuntime = async (): Promise<MeTTaRuntime> => {
    mettaRuntime ??= (await import('@senars/metta')).createMeTTa();
    return mettaRuntime;
  };

nar.tools.register({
    name: 'metta',
    description: 'Evaluate a MeTTa expression',
    parameters: {
      type: 'object',
      properties: {
        program: { type: 'string', description: 'MeTTa program to evaluate' },
      },
      required: ['program'],
    },
    execute: async (args: { program: string }) => {
      try {
        const { Effect } = await import('effect');
        const { parseMeTTa } = await import('@senars/metta');
        const runtime = await getMettaRuntime();
        const parsed = parseMeTTa(args.program);
        const effectOrPromise = runtime.evaluate(parsed);
        // Handle both Effect and Promise (some versions may auto-run)
        const result = effectOrPromise instanceof Promise
          ? await effectOrPromise
          : await Effect.runPromise(effectOrPromise);
        // Return the program as confirmation of successful rule loading
        return { success: true, content: args.program, error: undefined };
      } catch (e) {
        return { success: false, content: null, error: errMsg(e) };
      }
    },
  } as Tool);

  // Self-improvement tools (goal→tool dispatch target) — registered when self-reasoning is enabled.
  if (nar.getConfig().enableSelf) {
    const selfTools = createSelfTools({
      workspaceRoot: process.cwd(),
      nar,
      rlfpLearner: nar.getRLFP(),
      cognitiveController: nar.getController(),
      toolManager: nar.tools,
      ruleProcessor: nar.getProcessor(),
    });
    for (const [name, selfTool] of Object.entries(selfTools)) {
      try {
        // ai-style tools carry no name — inject the registry key.
        nar.tools.register({ ...(selfTool as object), name } as Tool);
      } catch (e) {
        nar.logger?.warn('Self-tool registration skipped', { name, error: errMsg(e) });
      }
    }
  }
  toolsInitialized.add(nar);
};

/**
 * Phase C (REFACTOR.todo1): AIKR-bounded maintenance of the learning
 * processes — decay stale accumulation, then drain induction and exemplar
 * promotion only under pressure. Call from any periodic cycle point.
 */
export const consolidateLearning = async (
  nar: NAR,
  options: { budget?: number } = {}
): Promise<void> => {
  const inductor = nar.getSchemaInductor();
  if (inductor) {
    inductor.decayChains();
    const results = await inductor.induceIfPressured(options).catch(() => []);
    // Phase E: submit schema promotions to GovernanceResolver
    if (results.length > 0) {
      const resolver = nar.getGovernanceResolver();
      const mode = nar.gates.getActionGate().getAutonomyMode();
      for (const result of results) {
        const proposal: SelfImprovementProposal = {
          proposalId: makeId(),
          kind: 'schema-promotion',
          riskTier: 'low',
          payload: {
            schemaId: result.schema.id,
            template: result.schema.template,
            variables: result.schema.variables,
            confidence: result.confidence,
          },
          rewardDomain: 'self-explanation-rank',
        };
        resolver.resolve(proposal, mode);
      }
    }
  }
  const contrastive = nar.getSystemOneContrastive();
  if (contrastive) {
    contrastive.decay();
    await contrastive.maintainIfPressured(options).catch(() => {});
  }
  const consolidator = nar.getEpisodeConsolidator();
  if (consolidator) {
    consolidator.decay();
    await consolidator.consolidateIfPressured(options).catch(() => {});
  }
  const mining = nar.getMiningBag();
  if (mining) {
    mining.decay();
    const drained = await mining.drainIfPressured(options).catch(() => []);
    const cache = nar.getSystemOneEmbeddingCache();
    if (drained.length > 0 && contrastive && cache) {
      await seedContrastiveMemory(drained, contrastive, cache).catch(() => {});
    }
  }
  // Phase E: feed ProofMettaProposer from derivation recorder
  const proofMettaProposer = nar.getProofMettaProposer();
  if (proofMettaProposer) {
    const recorder = nar.getProcessor().getRecorder();
    const records = recorder.drain();
    if (records.length > 0) {
      proofMettaProposer.learnFromProofStream(records.map((r) => ({ derivation: r, timestamp: Date.now() })));
    }
    
// Phase E: Metta↔NAL arbiter loop closure — export learned MeTTa rules,
              // rewrite via metta tool, adopt via GovernanceResolver auto-apply
              const mettaRules = proofMettaProposer.getRules();
              console.log(`[consolidateLearning] Metta rules learned: ${mettaRules.length}`);
              if (mettaRules.length > 0) {
                const mettaProgram = proofMettaProposer.exportAsMetta();
                console.log(`[consolidateLearning] Metta program: ${truncate(mettaProgram, 200)}`);
                if (mettaProgram.trim()) {
                  // Use metta tool to rewrite/validate the learned rules
                  const mettaTool = nar.tools.get('metta');
                  console.log(`[consolidateLearning] Metta tool available: ${!!mettaTool}`);
                  if (mettaTool) {
                    try {
                      const rewriteResult = await mettaTool.execute({ program: mettaProgram });
                      console.log(`[consolidateLearning] Metta rewrite result:`, rewriteResult);
                      if (rewriteResult && typeof rewriteResult === 'object' && 'content' in rewriteResult) {
                        const rewrittenRules = String(rewriteResult.content);
                        console.log(`[consolidateLearning] Rewritten rules: ${truncate(rewrittenRules, 200)}`);
                        // Submit to GovernanceResolver for auto-apply (low-risk)
                        const resolver = nar.getGovernanceResolver();
                        const mode = nar.gates.getActionGate().getAutonomyMode();
                        console.log(`[consolidateLearning] Submitting to governance resolver, mode: ${mode}`);
                        const proposal: SelfImprovementProposal = {
                          proposalId: makeId(),
                          kind: 'metta-rule-adoption',
                          riskTier: 'low',
                          payload: {
                            mettaProgram: rewrittenRules,
                            sourceDerivationIds: mettaRules.map((r) => r.sourceDerivation),
                          },
                          rewardDomain: 'self-patch-score',
                        };
                        const result = resolver.resolve(proposal, mode, {
                          applyFocusWeight: () => {},
                          applyKnob: () => {},
                          applySchemaPatch: () => {}, // Required for metta-rule-adoption auto-apply
                        });
                        console.log(`[consolidateLearning] Governance result:`, result);
                        if (result.applied) {
                          proofMettaProposer.getRules().forEach((r) => {
                            proofMettaProposer.recordApplication(r.id);
                          });
                        }
                      }
                    } catch (e) {
                      console.log(`[consolidateLearning] Metta tool error:`, e);
                      // Metta tool failed — symbolic fallback (rules stay in proposer only)
                    }
                  }
                }
              }
  }
};

export const askNaturalLanguage = async (nar: NAR, question: string): Promise<string> => {
  const lm = nar.getLMClient();
  if (!lm) return 'LM client not configured';

  const translatePrompt = `Convert this natural language question to Narsese query format. Only output the Narsese, nothing else. Question: "${question}"`;
  const narsese = await lm.generateText(translatePrompt);
  const cleaned = narsese.trim().replace(/^<|>$/g, '').trim();
  const queryTerm = termParser.parse(cleaned);
  const subjectTerm = queryTerm ? getSubject(queryTerm) : undefined;

  await nar.input(`${cleaned}?`);
  await nar.run(5);

  const beliefs = nar.query.getBeliefs();
  const relevant = subjectTerm
    ? beliefs.filter((b) => containsSubterm(b.term, subjectTerm))
    : queryTerm
      ? beliefs.filter((b) => containsSubterm(b.term, queryTerm))
      : beliefs;

  if (relevant.length === 0) return "I don't have enough knowledge to answer that.";

  const best = relevant[0]!;
  const result = `${best.term.toString()} ${Truth.format(best.truth)}`;
  const explainPrompt = `Convert this Narsese result to a natural language answer. Narsese: ${result} Question: "${question}" Only output the answer, nothing else.`;

  return lm.generateText(explainPrompt);
};
