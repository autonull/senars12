import type {NAR} from '../../nar';

export interface BeliefHandlerDeps {
    nar: NAR;
    send: (channel: string, user: string, text: string) => void;
}

export function isBelief(text: string): boolean {
    return text.trim().endsWith('.');
}

export function createBeliefHandler(deps: BeliefHandlerDeps) {
    return async (channel: string, user: string, text: string): Promise<number> => {
  const beliefText = text.trim();
  await deps.nar.believe(beliefText);
        deps.send(channel, user, `Added: ${beliefText}`);

        const derived = await deps.nar.run(3);
        if (derived > 0) {
            deps.send(channel, user, `Derived ${derived} new belief(s)`);
        }
        return derived;
    };
}