export declare const LLM_COMMANDS: readonly [
  'send',
  'remember',
  'query',
  'episodes',
  'read-file',
  'write-file',
  'append-file',
  'search',
  'shell',
  'metta',
  'pin',
  'tavily-search',
  'technical-analysis',
];
export type LlmCommand = (typeof LLM_COMMANDS)[number];
export interface ParsedCommand {
  readonly command: LlmCommand;
  readonly args: string[];
  readonly raw: string;
}
export declare class MettaCommandParser {
  #private;
  parse(llmOutput: string): ParsedCommand[];
}
//# sourceMappingURL=MettaCommandParser.d.ts.map
