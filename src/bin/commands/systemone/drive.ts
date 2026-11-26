/** Drive stimulation: .drive stimulate <name> [intensity] */

import { cmd } from '@senars/cli';
import { dispatchSub } from '../args';
import { finiteOr } from '@senars/util/numeric';
import type { SelfMetaView } from './types';
import type { BotRuntime } from '../context';

const stimulateDrive = (
  rt: BotRuntime,
  name: string | undefined,
  raw: string | undefined
): string => {
  if (!name) return 'Usage: .drive stimulate <name> [intensity]';
  const metaGame = rt.wired.nar.getSelfMetaGame?.() as unknown as SelfMetaView | undefined;
  if (!metaGame) return 'Self-meta-game not available';
  const { scheduler } = metaGame;
  if (!scheduler) return 'No scheduler attached (drives require scheduler)';
  const intensity = finiteOr(raw, 1.0);
  const check = scheduler.rewardGate.process({
    eventId: `drive-${Date.now()}`,
    rewardSignal: intensity,
    rewardType: 'intrinsic',
    targetType: 'policy-weights',
    targetId: 'drive',
    domain: 'self-scheduler',
  });
  return check.accepted
    ? `Drive ${name} stimulated (intensity=${intensity})`
    : `Drive ${name} rejected: ${check.rejectionReason}`;
};

export const driveCommand = cmd(
  'drive',
  'Drive stimulation: .drive stimulate <name> [intensity]',
  (rt: BotRuntime) => (args = '') => {
    const usage = 'Usage: .drive stimulate <name> [intensity]';
    return dispatchSub(
      args,
      { stimulate: ([name, raw]) => stimulateDrive(rt, name, raw) },
      { usage }
    );
  }
);