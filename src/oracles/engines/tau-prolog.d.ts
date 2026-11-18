declare module 'tau-prolog' {
  export interface Session {
    consult(program: string): Promise<void>;
    query(goal: string): Promise<Iterator<{ bindings: Record<string, unknown> }>>;
    answer(): Promise<{ bindings: Record<string, unknown> } | null>;
  }
  export function create(): Session;
}
