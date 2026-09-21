/**
 * P5 (TODO19): an external, non-builtin `Game` — proof that third-party
 * environments plug into the arcade harness and the NARBuilder without
 * touching `nar/src/game/registry.ts`. Doubles as the builder's third-profile
 * smoke (the `device` profile is built and described in-process).
 * Run: `pnpm tsx examples/external-env.ts`
 */
import { GameFocus } from '../nar/src/focus/GameFocus.js';
import { GameRegistry } from '../nar/src/game/registry.js';
import { SeededRNG } from '../nar/src/game/SeededRNG.js';
import type { Game, GameOutcome, Perception } from '../nar/src/game/Game.js';
import { TabularQReflex } from '../nar/src/reflex/TabularQReflex.js';
import { NARBuilder } from '../nar/src/agent/builder.js';

interface ThermostatState {
  temp: number;
  energy: number;
  ret: number;
}

/** External env: keep a room in the comfort band; energy costs are charged. */
export class ThermostatGame implements Game<ThermostatState, number> {
  readonly id = 'thermostat';
  readonly #rng: SeededRNG;
  readonly #internal: ThermostatState;

  constructor(seed: number) {
    this.#rng = new SeededRNG(seed);
    this.#internal = { temp: 12 + this.#rng.next() * 8, energy: 0, ret: 0 }; // cold start
  }

  #band(): string {
    return this.#internal.temp < 15 ? 'cold' : this.#internal.temp > 27 ? 'hot' : 'warm';
  }

  observe(): Perception {
    return {
      stateId: `${this.id}#${this.#band()}`,
      features: { temp: this.#internal.temp, energy: this.#internal.energy },
      confidence: 1,
      terminal: false,
    };
  }

  state(): ThermostatState {
    return { ...this.#internal };
  }

  legalActions(): number[] {
    return [0, 1, 2];
  }

  step(action: number | string): GameOutcome {
    const a = Number(action);
    const drift = (this.#rng.next() - 0.5) * 2; // ambient drift each tick
    if (a === 1) {
      this.#internal.temp += 2 + drift;
      this.#internal.energy += 1;
    } else if (a === 2) {
      this.#internal.temp -= 2 + drift;
      this.#internal.energy += 1;
    } else {
      this.#internal.temp += drift;
    }
    const comfort = 1 - Math.abs(this.#internal.temp - 21) / 10; // gradient toward 21°C
    const reward = comfort - this.#internal.energy * 0.05;
    this.#internal.ret += reward;
    return { reward, terminal: false };
  }
}

// Third-party registration — the registry stays open, nothing rebuilt twice.
const registry = new GameRegistry().register({
  name: 'thermostat',
  description: 'External env: keep the room in 18–24°C while minimizing energy.',
  actionLegend: 'Actions: 0=idle, 1=heat, 2=cool.',  create: (seed) => new ThermostatGame(seed),
});

// Builder third-profile smoke: device profile builds LM-free, tier-0.
const wired = await NARBuilder.fromProfile('device').build();
const { subsystems } = wired.describe();
if (subsystems.includes('lm') || subsystems.includes('systemOne'))
  throw new Error('device profile must be LM-free');
console.log(`builder smoke: device profile → subsystems=[${subsystems.join(', ') || 'none'}]`);

// Play the external game through the arcade harness (per-instance gates, F2).
for (let episode = 0; episode < 20; episode++) {
  const game = registry.create('thermostat', episode);
  const focus = new GameFocus({ focusId: `thermostat-e${episode}`, game });
  focus.bindReflex(new TabularQReflex('thermostat-reflex', { epsilon: 0.2 }));
  for (let tick = 0; tick < 50; tick++) await focus.step(10);
  const { temp, energy, ret } = game.state();
  console.log(`episode ${episode}: temp=${temp.toFixed(1)}°C energy=${energy} return=${ret.toFixed(2)}`);
}
