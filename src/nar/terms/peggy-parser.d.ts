export interface ParseOptions {
  termFactory?: any;
  grammarSource?: string;
  startRule?: string;
}

export interface ParseResult {
  term?: any;
  punctuation?: string;
  truthValue?: any;
  taskType?: string;
  kind?: string;
  symbol?: string;
  args?: any[];
  operator?: string;
  components?: any[];
  [key: string]: any;
}

export function parse(input: string, options?: ParseOptions): ParseResult;
