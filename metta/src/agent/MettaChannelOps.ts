import { defineOp, getOp } from '../core/ops.js';
import type { MeTTaAtom } from '../types/ast.js';
import { sym } from '../types/ast.js';

export function createChannelOps(send: (target: string, text: string) => Promise<void>) {
  return {
    send: defineOp('send', (target: MeTTaAtom, message: MeTTaAtom): MeTTaAtom => {
      const t =
        target.kind === 3 ? target.value : target.kind === 0 ? target.value : String(target);
      const m =
        message.kind === 3 ? message.value : message.kind === 0 ? message.value : String(message);
      send(t, m).catch(() => {});
      return sym('ok');
    }),

    schedule: defineOp('schedule', (delayMs: MeTTaAtom, action: MeTTaAtom): MeTTaAtom => {
      const ms =
        delayMs.kind === 2 ? delayMs.value : delayMs.kind === 0 ? Number(delayMs.value) : 0;
      setTimeout(() => {
        const op = getOp('exec');
        if (op) op.execute(action);
      }, ms);
      return sym('scheduled');
    }),

    wait: defineOp('wait', (_condition: MeTTaAtom, _timeoutMs: MeTTaAtom): MeTTaAtom => {
      return sym('waited');
    }),
  };
}
