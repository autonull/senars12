/**
 * Arena — competitive/cooperative multi-agent evaluation.
 *
 * The arena runs multiple agents in shared habitats,
 * enabling tournaments, cooperation tests, and comparison.
 */

import type { HabitatConfig, HabitatState, HabitatAction, HabitatStepResult, HabitatRegistry } from './habitat.js';
import type { Scorecard, EpisodeResult } from './pack.js';

/** Arena identifier. */
export type ArenaId = string & { readonly __brand: unique symbol };

/** Agent entry in arena. */
export interface ArenaAgent {
  /** Agent ID. */
  id: string;
  /** Agent name. */
  name: string;
  /** Agent type/kind. */
  kind: string;
  /** Configuration. */
  config: Record<string, unknown>;
  /** Current habitat state (per habitat). */
  habitatStates: Map<string, HabitatState>;
  /** Scorecard. */
  scorecard?: Scorecard;
}

/** Arena match configuration. */
export interface ArenaMatch {
  /** Match ID. */
  id: string;
  /** Habitat for this match. */
  habitat: HabitatConfig;
  /** Participating agents. */
  agents: ArenaAgent[];
  /** Match type. */
  type: 'competitive' | 'cooperative' | 'mixed';
  /** Max episodes. */
  maxEpisodes: number;
  /** Seed. */
  seed: number;
}

/** Arena tournament configuration. */
export interface ArenaTournament {
  /** Tournament ID. */
  id: string;
  /** Matches. */
  matches: ArenaMatch[];
  /** Scoring function. */
  scoring: ScoringFunction;
  /** Ranking method. */
  ranking: 'elo' | 'points' | 'winrate';
}

/** Scoring function for matches. */
export type ScoringFunction = (
  match: ArenaMatch,
  results: Map<string, EpisodeResult[]>
) => Map<string, number>;

/** Default competitive scoring (win = 1, draw = 0.5, loss = 0). */
export function competitiveScoring(
  match: ArenaMatch,
  results: Map<string, EpisodeResult[]>
): Map<string, number> {
  const scores = new Map<string, number>();
  const agentIds = match.agents.map(a => a.id);

  // Initialize scores
  for (const id of agentIds) {
    scores.set(id, 0);
  }

  // For competitive: compare final rewards
  const rewards = new Map<string, number>();
  for (const [agentId, episodes] of results) {
    const totalReward = episodes.reduce((sum, ep) => sum + ep.totalReward, 0);
    rewards.set(agentId, totalReward / episodes.length);
  }

  // Pairwise comparison
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      const id1 = agentIds[i]!;
      const id2 = agentIds[j]!;
      const r1 = rewards.get(id1) ?? 0;
      const r2 = rewards.get(id2) ?? 0;

      if (r1 > r2) {
        scores.set(id1, (scores.get(id1) ?? 0) + 1);
      } else if (r2 > r1) {
        scores.set(id2, (scores.get(id2) ?? 0) + 1);
      } else {
        scores.set(id1, (scores.get(id1) ?? 0) + 0.5);
        scores.set(id2, (scores.get(id2) ?? 0) + 0.5);
      }
    }
  }

  return scores;
}

/** Default cooperative scoring (shared reward). */
export function cooperativeScoring(
  match: ArenaMatch,
  results: Map<string, EpisodeResult[]>
): Map<string, number> {
  const scores = new Map<string, number>();

  // All agents get the same score: mean of all rewards
  let totalReward = 0;
  let totalEpisodes = 0;
  for (const episodes of results.values()) {
    for (const ep of episodes) {
      totalReward += ep.totalReward;
      totalEpisodes++;
    }
  }
  const sharedScore = totalEpisodes > 0 ? totalReward / totalEpisodes : 0;

  for (const agent of match.agents) {
    scores.set(agent.id, sharedScore);
  }

  return scores;
}

/** Arena runner — executes matches and tournaments. */
export class ArenaRunner {
  private registry: HabitatRegistry;
  private tournaments: Map<string, ArenaTournament> = new Map();
  private matchResults: Map<string, Map<string, EpisodeResult[]>> = new Map();

  constructor(registry: HabitatRegistry) {
    this.registry = registry;
  }

  /** Register a tournament. */
  registerTournament(tournament: ArenaTournament): void {
    this.tournaments.set(tournament.id, tournament);
  }

  /** Run a single match. */
  async runMatch(
    match: ArenaMatch,
    agentActFn: (agent: ArenaAgent, state: HabitatState, habitat: HabitatConfig) => Promise<HabitatAction>
  ): Promise<Map<string, EpisodeResult[]>> {
    const results = new Map<string, EpisodeResult[]>();

    // Initialize agent states
    for (const agent of match.agents) {
      agent.habitatStates.set(match.habitat.id, createInitialState(match.habitat));
    }

    for (let episode = 0; episode < match.maxEpisodes; episode++) {
      // Reset habitat for new episode
      const state = createInitialState(match.habitat);
      for (const agent of match.agents) {
        agent.habitatStates.set(match.habitat.id, state);
      }

      const episodeResults = await this.runEpisode(match, state, agentActFn);

      for (const [agentId, epResult] of episodeResults) {
        const agentResults = results.get(agentId) ?? [];
        agentResults.push(epResult);
        results.set(agentId, agentResults);
      }
    }

    this.matchResults.set(match.id, results);
    return results;
  }

  /** Run a single episode. */
  private async runEpisode(
    match: ArenaMatch,
    initialState: HabitatState,
    agentActFn: (agent: ArenaAgent, state: HabitatState, habitat: HabitatConfig) => Promise<HabitatAction>
  ): Promise<Map<string, EpisodeResult>> {
    const state = { ...initialState };
    const episodeRewards = new Map<string, number[]>();
    const stepRewards = new Map<string, number[]>();
    let terminated = false;
    let terminationReason: string | undefined;
    let steps = 0;

    // Initialize rewards
    for (const agent of match.agents) {
      episodeRewards.set(agent.id, []);
      stepRewards.set(agent.id, []);
    }

    while (!terminated && steps < match.habitat.maxSteps) {
      // Each agent acts (in parallel for competitive, sequential for cooperative)
      const actions = new Map<string, HabitatAction>();

      if (match.type === 'cooperative') {
        // Sequential: agents act in order
        for (const agent of match.agents) {
          const action = await agentActFn(agent, state, match.habitat);
          actions.set(agent.id, action);
        }
      } else {
        // Parallel: all agents act simultaneously
        const promises = match.agents.map(async agent => {
          const action = await agentActFn(agent, state, match.habitat);
          return [agent.id, action] as const;
        });
        const actionResults = await Promise.all(promises);
        for (const [id, action] of actionResults) {
          actions.set(id, action);
        }
      }

      // Apply actions (simplified: first action wins for competitive)
      let combinedAction: HabitatAction;
      if (match.type === 'competitive') {
        combinedAction = actions.values().next().value!;
      } else {
        // For cooperative, merge actions (simplified)
        combinedAction = {
          type: 'joint',
          params: { actions: Object.fromEntries(actions) },
        };
      }

      // Step habitat
      const stepResult = stepHabitat(match.habitat, state, combinedAction, this.registry);
      state.step = stepResult.state.step;
      state.episode = stepResult.state.episode;
      state.entities = stepResult.state.entities;
      state.agent = stepResult.state.agent;
      state.env = stepResult.state.env;
      state.rngState = stepResult.state.rngState;

      // Record rewards
      for (const agent of match.agents) {
        const rewards = episodeRewards.get(agent.id)!;
        rewards.push(stepResult.reward);
        stepRewards.get(agent.id)!.push(stepResult.reward);
      }

      terminated = stepResult.terminated;
      terminationReason = stepResult.reason;
      steps++;
    }

    // Build episode results
    const results = new Map<string, EpisodeResult>();
    for (const agent of match.agents) {
      const rewards = episodeRewards.get(agent.id)!;
      const totalReward = rewards.reduce((a, b) => a + b, 0);

      results.set(agent.id, {
        episode: state.episode,
        steps,
        totalReward,
        termination: terminationReason ?? 'maxSteps',
        stepRewards: rewards,
        lane: 'lane-a' as any,
      });
    }

    return results;
  }

  /** Run full tournament. */
  async runTournament(
    tournamentId: string,
    agentActFn: (agent: ArenaAgent, state: HabitatState, habitat: HabitatConfig) => Promise<HabitatAction>
  ): Promise<ArenaTournamentResult> {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const matchScores = new Map<string, Map<string, number>>();

    for (const match of tournament.matches) {
      const results = await this.runMatch(match, agentActFn);
      const scores = tournament.scoring(match, results);
      matchScores.set(match.id, scores);
    }

    // Compute rankings
    const rankings = this.computeRankings(tournament, matchScores);

    return {
      tournamentId,
      matchScores,
      rankings,
      timestamp: Date.now(),
    };
  }

  /** Compute agent rankings from match scores. */
  private computeRankings(
    tournament: ArenaTournament,
    matchScores: Map<string, Map<string, number>>
  ): ArenaRanking[] {
    const agentTotals = new Map<string, number>();
    const agentMatches = new Map<string, number>();

    for (const scores of matchScores.values()) {
      for (const [agentId, score] of scores) {
        agentTotals.set(agentId, (agentTotals.get(agentId) ?? 0) + score);
        agentMatches.set(agentId, (agentMatches.get(agentId) ?? 0) + 1);
      }
    }

    const rankings: ArenaRanking[] = [];
    for (const [agentId, total] of agentTotals) {
      rankings.push({
        agentId,
        rank: 0, // Will be set after sorting
        totalScore: total,
        matchesPlayed: agentMatches.get(agentId) ?? 0,
        averageScore: total / (agentMatches.get(agentId) ?? 1),
      });
    }

    // Sort by ranking method
    if (tournament.ranking === 'points') {
      rankings.sort((a, b) => b.totalScore - a.totalScore);
    } else if (tournament.ranking === 'winrate') {
      rankings.sort((a, b) => b.averageScore - a.averageScore);
    }
    // ELO would require more complex implementation

    return rankings.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /** Get match results. */
  getMatchResults(matchId: string): Map<string, EpisodeResult[]> | undefined {
    return this.matchResults.get(matchId);
  }
}

/** Create initial habitat state. */
function createInitialState(config: HabitatConfig): HabitatState {
  return {
    step: 0,
    episode: 0,
    entities: new Map(config.initialState.entities),
    agent: { ...config.initialState.agent },
    env: new Map(config.initialState.env),
    rngState: config.seed.toString(),
  };
}

/** Step habitat (re-export from habitat.ts). */
function stepHabitat(
  config: HabitatConfig,
  state: HabitatState,
  action: HabitatAction,
  registry: HabitatRegistry
): HabitatStepResult {
  const transition = registry.transitions.get(config.transition);
  const rewardFn = registry.rewards.get(config.reward);
  const termination = registry.terminations.get(config.termination.custom ?? 'default');

  if (!transition) throw new Error(`Transition not found: ${config.transition}`);
  if (!rewardFn) throw new Error(`Reward not found: ${config.reward}`);

  const nextState = transition(state, action, config);
  nextState.step = state.step + 1;

  const reward = rewardFn(state, action, nextState, config);

  let terminated = false;
  let reason: string | undefined;

  if (config.termination.maxSteps && nextState.step >= config.maxSteps) {
    terminated = true;
    reason = 'maxSteps';
  }

  if (!terminated && termination) {
    const termResult = termination(nextState, config);
    terminated = termResult.terminated;
    reason = termResult.reason;
  }

  if (terminated) {
    nextState.episode = state.episode + 1;
    nextState.step = 0;
  }

  return {
    state: nextState,
    reward,
    terminated,
    reason,
    info: { action: action.type },
  };
}

/** Tournament result. */
export interface ArenaTournamentResult {
  /** Tournament ID. */
  tournamentId: string;
  /** Scores per match. */
  matchScores: Map<string, Map<string, number>>;
  /** Final rankings. */
  rankings: ArenaRanking[];
  /** Timestamp. */
  timestamp: number;
}

/** Agent ranking entry. */
export interface ArenaRanking {
  /** Agent ID. */
  agentId: string;
  /** Rank (1-based). */
  rank: number;
  /** Total score. */
  totalScore: number;
  /** Matches played. */
  matchesPlayed: number;
  /** Average score. */
  averageScore: number;
}

/** Create a simple arena agent. */
export function createArenaAgent(
  id: string,
  name: string,
  kind: string,
  config: Record<string, unknown> = {}
): ArenaAgent {
  return {
    id,
    name,
    kind,
    config,
    habitatStates: new Map(),
  };
}