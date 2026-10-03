/** Persona profile and the bot skill registry (`.profile`, `.skill-*`). */

import { removeBy } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import type { BotConfig } from '../../config/index.js';
import { tokenize } from './args.js';
import type { BotRuntime } from './context.js';

type SkillEntry = BotConfig['skills'][number] & { name?: string };

/** The mutable skill list from the effective config. */
const skillsOf = (rt: BotRuntime): SkillEntry[] => rt.appConfig.bot.skills as SkillEntry[];

const findSkill = (rt: BotRuntime, id: string): SkillEntry | undefined =>
  skillsOf(rt).find((s) => s.id === id || s.name === id);

export const profileCommandsFor = (rt: BotRuntime) => [
  cmd('profile', 'Show or set profile fields', (args = '') => {
    const [field, ...rest] = tokenize(args);
    const { profile, tier } = rt;
    if (!field) {
      return `name=${profile.name} personality=${profile.personality?.slice(0, 80)} tier=${tier} join=${profile.joinMessage?.slice(0, 80) ?? '—'}`;
    }
    if (field === 'tier') return 'Use .tier quality|fast|structured to switch chat tier';
    if (field in profile && rest.length) {
      (profile as Record<string, unknown>)[field] = rest.join(' ');
      return `profile.${field} updated`;
    }
    return 'Usage: .profile [name|personality|joinmsg|tier <value>]';
  }),
  cmd('skills', 'List skills', () => {
    const skills = skillsOf(rt);
    return skills.length
      ? skills
          .map(
            (s) =>
              `  ${s.id ?? s.name ?? '?'} [${s.enabled === false ? 'off' : 'on'}] ${s.description ?? ''}`
          )
          .join('\n')
      : '(no skills configured)';
  }),
  cmd('skill-enable', 'Enable a skill', (args = '') => {
    const id = args.trim();
    const s = findSkill(rt, id);
    if (!s) return `Unknown skill: ${id}`;
    s.enabled = true;
    return `Enabled ${id} (persist with .config-save)`;
  }),
  cmd('skill-disable', 'Disable a skill', (args = '') => {
    const id = args.trim();
    const s = findSkill(rt, id);
    if (!s) return `Unknown skill: ${id}`;
    s.enabled = false;
    return `Disabled ${id} (persist with .config-save)`;
  }),
  cmd('skill-add', 'Add a skill: <id> <description> <instructions>', (args = '') => {
    const [id, ...rest] = tokenize(args);
    const instructions = rest.pop();
    if (!id || !instructions || !rest.length)
      return 'Usage: .skill-add <id> <description> <instructions>';
    const skills = skillsOf(rt);
    if (skills.some((s) => s.id === id)) return `Skill exists: ${id}`;
    skills.push({ id, description: rest.join(' '), instructions, enabled: true });
    return `Added ${id} (persist with .config-save)`;
  }),
  cmd('skill-remove', 'Remove a skill', (args = '') => {
    const id = args.trim();
    const skills = skillsOf(rt);
    if (!removeBy(skills, (s) => s.id === id || s.name === id)) return `Unknown skill: ${id}`;
    return `Removed ${id} (persist with .config-save)`;
  }),
  cmd('skill-edit', 'Edit a skill field: <id> <field> <value>', (args = '') => {
    const [id, field, ...rest] = tokenize(args);
    if (!id || !field || !rest.length) {
      return 'Usage: .skill-edit <id> <description|instructions|enabled> <value>';
    }
    const s = findSkill(rt, id);
    if (!s) return `Unknown skill: ${id}`;
    if (!(field in s)) return `Unknown field: ${field}`;
    (s as Record<string, unknown>)[field] =
      field === 'enabled' ? rest[0] !== 'false' : rest.join(' ');
    return `Updated ${id}.${field} (persist with .config-save)`;
  }),
];
