import type {NAR} from '../nar/nar.js';
import {ToolManager} from '../nar/tools/tool-registry.js';
import type {CommandDefinition} from '../io/commands/registry.js';

export interface SkillEntry {
    name: string;
    description: string;
    signature?: string;
    example?: string;
    category: 'tool' | 'command' | 'nal';
}

export class SkillCatalog {
    private readonly nar: NAR;
    private readonly customSkills: Map<string, SkillEntry> = new Map();
    private toolDescriptors: Map<string, SkillEntry> = new Map();
    private commandDescriptors: Map<string, SkillEntry> = new Map();
    private nalDescriptors: Map<string, SkillEntry> = new Map();

    constructor(nar: NAR) {
        this.nar = nar;
        this.initializeNALSkills();
    }

    private initializeNALSkills(): void {
        const nalSkills: SkillEntry[] = [
            {name: 'deduction', description: 'If (A --> B) and (B --> C), derive (A --> C)', category: 'nal'},
            {name: 'abduction', description: 'If (A --> B) and (C --> B), derive (C --> A)', category: 'nal'},
            {name: 'induction', description: 'If (A --> B) and (A --> C), derive (C --> B)', category: 'nal'},
            {name: 'revision', description: 'Merge conflicting evidence for same belief', category: 'nal'},
            {name: 'negation', description: 'Handle negative terms and contradictory beliefs', category: 'nal'},
            {name: 'temporal', description: 'Temporal reasoning with before/after relations', category: 'nal'},
            {name: 'goal-decomposition', description: 'Break complex goals into subgoals', category: 'nal'},
        ];
        for (const skill of nalSkills) {
            this.nalDescriptors.set(skill.name, skill);
        }
    }

    registerCustomSkill(name: string, description: string, example?: string): void {
        this.customSkills.set(name, {name, description, example, category: 'command'});
    }

    updateFromToolManager(toolManager: ToolManager): void {
        this.toolDescriptors.clear();
        const tools = toolManager.discoverTools();
        for (const tool of tools) {
            this.toolDescriptors.set(tool.name, {
                name: tool.name,
                description: tool.description,
                category: 'tool',
            });
        }
    }

    updateFromCommands(commands: ReadonlyMap<string, CommandDefinition>): void {
        this.commandDescriptors.clear();
        for (const [name, cmd] of commands) {
            const cleanName = name.startsWith('.') ? name.slice(1) : name;
            this.commandDescriptors.set(cleanName, {
                name: cleanName,
                description: cmd.description,
                signature: cmd.usage,
                category: 'command',
            });
        }
    }

    getSkillsText(): string {
        const sections: string[] = [];

        sections.push('### NAL Operations');
        for (const skill of this.nalDescriptors.values()) {
            sections.push(`- **${skill.name}**: ${skill.description}`);
        }

        sections.push('\n### Tools');
        for (const skill of this.toolDescriptors.values()) {
            sections.push(`- **${skill.name}**: ${skill.description}`);
        }

        sections.push('\n### Commands');
        for (const skill of this.commandDescriptors.values()) {
            sections.push(`- **${skill.name}** ${skill.signature || ''}: ${skill.description}`);
        }

        if (this.customSkills.size > 0) {
            sections.push('\n### Custom Skills');
            for (const skill of this.customSkills.values()) {
                sections.push(`- **${skill.name}**: ${skill.description}`);
            }
        }

        return sections.join('\n');
    }

    getSkillsForPrompt(): string {
        const items: string[] = [];

        for (const skill of this.nalDescriptors.values()) {
            items.push(`${skill.name}: ${skill.description}`);
        }

        for (const skill of this.toolDescriptors.values()) {
            items.push(`tool:${skill.name} - ${skill.description}`);
        }

        for (const skill of this.commandDescriptors.values()) {
            items.push(`cmd:${skill.name} - ${skill.description}`);
        }

        for (const skill of this.customSkills.values()) {
            items.push(`skill:${skill.name} - ${skill.description}`);
        }

        return items.join('\n');
    }
}