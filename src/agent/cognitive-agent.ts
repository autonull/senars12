import { verifyRecord } from '@senars/verification';
import { cachePath } from '@senars/config';
import { createLogger } from '@senars/util/logger';
import { createLogStore } from '@senars/log/store';
import {
  type CognitiveParameters,
  FAST_COGNITIVE_CONFIG,
  mergeParameters,
  validateParameters,
} from '../config/cognitive-parameters';
import type { NAR as NARType } from '../index';
import { NAR } from '../nar/core';
import { Truth, termParser } from '../terms/index';
import type { Task } from '../types/index';
import { DEFAULT_CONFIG } from '../types/index';
import { type CreateAgentConfig, createAgent } from './create-agent';
import type { TermTruth } from '../types/truth';
import { SenarsError } from '../errors/senars-error';


const log = createLogger({ scope: 'CognitiveAgent' });

export type CognitiveAgentPreset = 'chat';

export interface CognitiveAgentConfig {
  preset: CognitiveAgentPreset;
  resume?: boolean;
  statePath?: string;
  cognitiveParams?: Partial<CognitiveParameters>;
  lmService?: CreateAgentConfig['lmService'];
  episodicMemory?: CreateAgentConfig['episodicMemory'];
  persistence?: CreateAgentConfig['persistence'];
  /** MeTTa engine seam — `metta` sits above `nar`, so it is injected. */
  metta?: CreateAgentConfig['metta'];
}

export interface AnswerEnvelope {
  conclusion: string;
  truth: TermTruth;
  reputation: number;
}

export interface CognitiveAgent {
  teach(narsese: string): Promise<void>;
  ask(question: string): Promise<AnswerEnvelope>;
  checkpoint(): Promise<void>;
  stop(): Promise<void>;
  getNAR(): NARType | undefined;
}

const PRESET_PARAMS: Record<CognitiveAgentPreset, Partial<CognitiveParameters>> = {
  chat: FAST_COGNITIVE_CONFIG,
};

async function runBootSelfTest(nar: NARType): Promise<void> {
  const processor = nar.getProcessor();
  processor.setConfig({ recorderEnabled: true });
  const recorder = processor.getRecorder();
  if (!recorder) {
    throw new SenarsError('Boot POST failed: DerivationRecorder not available', 'VALIDATION_ERROR');
  }

  const syllogism = ['(cat --> animal). %1.00;0.90%', '(animal --> organism). %1.00;0.90%'];

  for (const stmt of syllogism) {
    await nar.believe(stmt);
  }
  await nar.run(20);

  // Test deduction: (cat --> animal) & (animal --> organism) |- (cat --> organism)
  const questionTerm = termParser.parse('(cat --> ?what)?');
  if (!questionTerm) {
    throw new SenarsError('Boot POST failed: could not parse test term', 'PARSE_ERROR');
  }

  await nar.question('(cat --> ?what)?');
  await nar.run(20);

  const answer = await nar.ask(questionTerm);
  if (!answer?.answer || !answer.truth || Truth.expectation(answer.truth) <= 0.5) {
    throw new SenarsError('Boot POST failed: syllogism derivation did not produce expected conclusion', 'VALIDATION_ERROR');
  }

  const records = recorder.drain();
  if (records.length === 0) {
    throw new SenarsError('Boot POST failed: no derivation records captured', 'VALIDATION_ERROR');
  }

  // Proof of traceability, not shape: every record must verify, and the drain
  // as a whole must contain at least one step whose truth the verifier
  // reproduced. A boot check that only inspected shape could not fail on a bad
  // rule; one that demanded a proof per record would fail on rules the
  // verifier's table does not cover.
  let proved = 0;
  for (const record of records) {
    const result = verifyRecord(record);
    if (!result.ok) {
      throw new SenarsError(`Boot POST failed: derivation verification failed - ${result.errors.join('; ')}`, 'VALIDATION_ERROR');
    }
    proved += result.truthVerified;
  }
  if (proved === 0) {
    throw new SenarsError('Boot POST failed: no step carried premise truths the verifier could prove', 'VALIDATION_ERROR');
  }

  log.info(`Boot POST passed: core logic verified (${proved} steps reproduced)`);
}

export async function createCognitiveAgent(config: CognitiveAgentConfig): Promise<CognitiveAgent> {
  const presetParams = PRESET_PARAMS[config.preset] ?? {};
  const validation = validateParameters({ ...presetParams, ...config.cognitiveParams });
  if (!validation.valid) {
    throw new SenarsError(`Invalid cognitive parameters: ${validation.errors.join(', ')}`, 'VALIDATION_ERROR');
  }

  const cognitiveParams = mergeParameters({ ...presetParams, ...config.cognitiveParams });

  const statePath = config.statePath ?? cachePath('nar-state');

  // Create a logStore for persistence
  const logStore = await createLogStore({
    dir: statePath,
    syncOnAppend: true,
  });

  const narInstance = new NAR({
    ...DEFAULT_CONFIG,
    persistState: true,
    statePath,
    logStore,
    cognitiveParams,
    enableEmbeddingLayer: false,
    metta: config.metta,
  });

  const agentConfig: CreateAgentConfig = {
    nar: narInstance,
    lmService: config.lmService,
    episodicMemory: config.episodicMemory,
    metta: config.metta,
  };

  const agent = await createAgent(agentConfig);
  const nar = agent.getNAR();

  if (!nar) {
    throw new SenarsError('Failed to get NAR instance from agent', 'VALIDATION_ERROR');
  }

  // Agent.start() already calls nar.start() via NAREngine.doInitialize()
  // Run boot self-test if not resuming (nar is already running)
  if (!config.resume) {
    await runBootSelfTest(nar);
  }

  const teach = async (narsese: string): Promise<void> => {
    await nar.believe(narsese);
    await nar.run(10);
  };

  const ask = async (question: string): Promise<AnswerEnvelope> => {
    const questionTerm = typeof question === 'string' ? termParser.parse(question) : question;
    if (!questionTerm) {
      return { conclusion: '', truth: { f: 0, c: 0 }, reputation: 0 };
    }

    await nar.question(question);
    await nar.run(20);

    const answer = await nar.ask(questionTerm);
    const reputation = nar.getSourceReputation?.()?.multiplier?.('nar-api') ?? 1.0;

    return {
      conclusion: answer?.answer ?? '',
      // Was `{ f: answer.confidence, c: 1 }` — the answer's f*c product read as a
      // frequency, with confidence hardcoded to 1. That reported a truth value the
      // engine never derived. Now it is the belief's own pair.
      truth: answer?.truth ?? { f: 0, c: 0 },
      reputation,
    };
  };

  const checkpoint = async (): Promise<void> => {
    const persister = (nar as any).persister;
    if (persister && typeof persister.save === 'function') {
      await persister.save();
    }
  };

  return {
    teach,
    ask,
    checkpoint,
    stop: () => agent.stop(),
    getNAR: () => nar,
  };
}
