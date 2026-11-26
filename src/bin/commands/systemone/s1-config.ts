/** System One config: .s1-config show|set <path> <value>|save|reload */

import { envStrOr } from '@senars/util/config';
import { cmd } from '@senars/cli';
import { dispatchSub, coerce, setPath } from '../args';
import { reloadAppConfig } from '../config';
import { writeJsonFile } from '@senars/util/fs';
import type { BotRuntime } from '../context';

export const s1ConfigCommand = cmd(
  's1-config',
  'System One config: .s1-config show|set <path> <value>|save|reload',
  (rt: BotRuntime) => async (args = '') => {
    const usage = 'Usage: .s1-config show|set <path> <value>|save|reload';
    return dispatchSub(
      args,
      {
        show: () => JSON.stringify(rt.appConfig.systemOne ?? {}, null, 2),
        set: ([path, ...rest]) => {
          if (!path || !rest.length) return 'Usage: .s1-config set <path> <value>';
          const value = coerce(rest.join(' '));
          return setPath(
            rt.appConfig as unknown as Record<string, unknown>,
            `systemOne.${path}`,
            value
          )
            ? `Set systemOne.${path} (persist with .s1-config save)`
            : `Unknown path: systemOne.${path}`;
        },
        save: async ([path]) => {
          const target = path || envStrOr('senars.config.json', 'SENARS_CONFIG');
          await writeJsonFile(target, rt.appConfig);
          return `Saved to ${target}`;
        },
        reload: () => reloadAppConfig(rt),
      },
      { defaults: ['show'], usage }
    );
  }
);