/**
 * Oracle schema generators for the genome.
 */

export function generateOracleSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// ============================================================================');
  lines.push('// ORACLE SCHEMAS — per-operation query/result/cert schemas');
  lines.push('// ============================================================================');
  lines.push('');

  // LM generateText
  lines.push('export const LMGenerateTextQuerySchema = z.object({');
  lines.push('  prompt: z.string(),');
  lines.push('  options: z.object({');
  lines.push('    task: z.string().optional(),');
  lines.push('    model: z.string().optional(),');
  lines.push('    temperature: z.number().min(0).max(2).optional(),');
  lines.push('    maxOutputTokens: z.number().int().positive().optional(),');
  lines.push('    signal: z.any().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type LMGenerateTextQuery = z.infer<typeof LMGenerateTextQuerySchema>;');
  lines.push('');

  lines.push('export const LMGenerateTextResultSchema = z.object({');
  lines.push('  text: z.string(),');
  lines.push('  usage: z.object({');
  lines.push('    promptTokens: z.number().int().nonnegative(),');
  lines.push('    completionTokens: z.number().int().nonnegative(),');
  lines.push('    totalTokens: z.number().int().nonnegative(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type LMGenerateTextResult = z.infer<typeof LMGenerateTextResultSchema>;');
  lines.push('');

  lines.push('export const LMGenerateTextCertSchema = z.object({');
  lines.push('  model: z.string(),');
  lines.push('  promptHash: z.string(),');
  lines.push('  seed: z.string().optional(),');
  lines.push('});');
  lines.push('export type LMGenerateTextCert = z.infer<typeof LMGenerateTextCertSchema>;');
  lines.push('');

  // LM generateObject
  lines.push('export const LMGenerateObjectQuerySchema = z.object({');
  lines.push('  prompt: z.string(),');
  lines.push('  schema: z.any(),');
  lines.push('  options: z.object({');
  lines.push('    task: z.string().optional(),');
  lines.push('    model: z.string().optional(),');
  lines.push('    temperature: z.number().min(0).max(2).optional(),');
  lines.push('    maxOutputTokens: z.number().int().positive().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type LMGenerateObjectQuery = z.infer<typeof LMGenerateObjectQuerySchema>;');
  lines.push('');

  lines.push('export const LMGenerateObjectResultSchema = z.object({');
  lines.push('  object: z.any(),');
  lines.push('  usage: z.object({');
  lines.push('    promptTokens: z.number().int().nonnegative(),');
  lines.push('    completionTokens: z.number().int().nonnegative(),');
  lines.push('    totalTokens: z.number().int().nonnegative(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type LMGenerateObjectResult = z.infer<typeof LMGenerateObjectResultSchema>;');
  lines.push('');

  lines.push('export const LMGenerateObjectCertSchema = z.object({');
  lines.push('  model: z.string(),');
  lines.push('  promptHash: z.string(),');
  lines.push('  schemaHash: z.string(),');
  lines.push('  seed: z.string().optional(),');
  lines.push('});');
  lines.push('export type LMGenerateObjectCert = z.infer<typeof LMGenerateObjectCertSchema>;');
  lines.push('');

  // LM stream
  lines.push('export const LMStreamQuerySchema = z.object({');
  lines.push('  prompt: z.string(),');
  lines.push('  options: z.object({');
  lines.push('    task: z.string().optional(),');
  lines.push('    model: z.string().optional(),');
  lines.push('    temperature: z.number().min(0).max(2).optional(),');
  lines.push('    maxOutputTokens: z.number().int().positive().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type LMStreamQuery = z.infer<typeof LMStreamQuerySchema>;');
  lines.push('');

  lines.push('export const LMStreamResultSchema = z.object({');
  lines.push('  stream: z.any(),');
  lines.push('});');
  lines.push('export type LMStreamResult = z.infer<typeof LMStreamResultSchema>;');
  lines.push('');

  lines.push('export const LMStreamCertSchema = z.object({');
  lines.push('  model: z.string(),');
  lines.push('  promptHash: z.string(),');
  lines.push('  seed: z.string().optional(),');
  lines.push('});');
  lines.push('export type LMStreamCert = z.infer<typeof LMStreamCertSchema>;');
  lines.push('');

  // Retrieval query
  lines.push('export const RetrievalQuerySchema = z.object({');
  lines.push('  query: z.string(),');
  lines.push('  topK: z.number().int().positive().optional(),');
  lines.push('  filter: z.record(z.string(), z.any()).optional(),');
  lines.push('});');
  lines.push('export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;');
  lines.push('');

  lines.push('export const RetrievalResultSchema = z.object({');
  lines.push('  results: z.array(z.object({');
  lines.push('    id: z.string(),');
  lines.push('    content: z.string(),');
  lines.push('    score: z.number(),');
  lines.push('    metadata: z.record(z.string(), z.any()).optional(),');
  lines.push('  })),');
  lines.push('});');
  lines.push('export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;');
  lines.push('');

  lines.push('export const RetrievalCertSchema = z.object({');
  lines.push('  index: z.string(),');
  lines.push('  queryHash: z.string(),');
  lines.push('  embeddingModel: z.string().optional(),');
  lines.push('});');
  lines.push('export type RetrievalCert = z.infer<typeof RetrievalCertSchema>;');
  lines.push('');

  // Engine Z3
  lines.push('export const EngineZ3QuerySchema = z.object({');
  lines.push('  formula: z.string(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineZ3Query = z.infer<typeof EngineZ3QuerySchema>;');
  lines.push('');

  lines.push('export const EngineZ3ResultSchema = z.object({');
  lines.push('  satisfiable: z.boolean(),');
  lines.push('  model: z.any().optional(),');
  lines.push('  proof: z.string().optional(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('    nodesVisited: z.number().int().nonnegative().optional(),');
  lines.push('    clausesGenerated: z.number().int().nonnegative().optional(),');
  lines.push('    backtracks: z.number().int().nonnegative().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineZ3Result = z.infer<typeof EngineZ3ResultSchema>;');
  lines.push('');

  lines.push('export const EngineZ3CertSchema = z.object({');
  lines.push('  engine: z.literal(\'z3\'),');
  lines.push('  formulaHash: z.string(),');
  lines.push('  proof: z.string().optional(),');
  lines.push('});');
  lines.push('export type EngineZ3Cert = z.infer<typeof EngineZ3CertSchema>;');
  lines.push('');

  // Engine Clingo
  lines.push('export const EngineClingoQuerySchema = z.object({');
  lines.push('  program: z.string(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineClingoQuery = z.infer<typeof EngineClingoQuerySchema>;');
  lines.push('');

  lines.push('export const EngineClingoResultSchema = z.object({');
  lines.push('  satisfiable: z.boolean(),');
  lines.push('  models: z.array(z.any()).optional(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('    modelsFound: z.number().int().nonnegative().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineClingoResult = z.infer<typeof EngineClingoResultSchema>;');
  lines.push('');

  lines.push('export const EngineClingoCertSchema = z.object({');
  lines.push('  engine: z.literal(\'clingo\'),');
  lines.push('  programHash: z.string(),');
  lines.push('  modelHash: z.string().optional(),');
  lines.push('});');
  lines.push('export type EngineClingoCert = z.infer<typeof EngineClingoCertSchema>;');
  lines.push('');

  // Engine MiniSat
  lines.push('export const EngineMiniSatQuerySchema = z.object({');
  lines.push('  cnf: z.string(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineMiniSatQuery = z.infer<typeof EngineMiniSatQuerySchema>;');
  lines.push('');

  lines.push('export const EngineMiniSatResultSchema = z.object({');
  lines.push('  satisfiable: z.boolean(),');
  lines.push('  model: z.any().optional(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('    decisions: z.number().int().nonnegative().optional(),');
  lines.push('    conflicts: z.number().int().nonnegative().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineMiniSatResult = z.infer<typeof EngineMiniSatResultSchema>;');
  lines.push('');

  lines.push('export const EngineMiniSatCertSchema = z.object({');
  lines.push('  engine: z.literal(\'minisat\'),');
  lines.push('  cnfHash: z.string(),');
  lines.push('  modelHash: z.string().optional(),');
  lines.push('});');
  lines.push('export type EngineMiniSatCert = z.infer<typeof EngineMiniSatCertSchema>;');
  lines.push('');

  // Engine Tau Prolog
  lines.push('export const EngineTauPrologQuerySchema = z.object({');
  lines.push('  program: z.string(),');
  lines.push('  query: z.string(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineTauPrologQuery = z.infer<typeof EngineTauPrologQuerySchema>;');
  lines.push('');

  lines.push('export const EngineTauPrologResultSchema = z.object({');
  lines.push('  success: z.boolean(),');
  lines.push('  bindings: z.array(z.record(z.string(), z.any())).optional(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('    inferences: z.number().int().nonnegative().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineTauPrologResult = z.infer<typeof EngineTauPrologResultSchema>;');
  lines.push('');

  lines.push('export const EngineTauPrologCertSchema = z.object({');
  lines.push('  engine: z.literal(\'tau-prolog\'),');
  lines.push('  programHash: z.string(),');
  lines.push('  queryHash: z.string(),');
  lines.push('});');
  lines.push('export type EngineTauPrologCert = z.infer<typeof EngineTauPrologCertSchema>;');
  lines.push('');

  // Engine MeTTa
  lines.push('export const EngineMettaQuerySchema = z.object({');
  lines.push('  program: z.string(),');
  lines.push('  query: z.string().optional(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineMettaQuery = z.infer<typeof EngineMettaQuerySchema>;');
  lines.push('');

  lines.push('export const EngineMettaResultSchema = z.object({');
  lines.push('  result: z.any(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineMettaResult = z.infer<typeof EngineMettaResultSchema>;');
  lines.push('');

  lines.push('export const EngineMettaCertSchema = z.object({');
  lines.push('  engine: z.literal(\'metta\'),');
  lines.push('  programHash: z.string(),');
  lines.push('  queryHash: z.string().optional(),');
  lines.push('});');
  lines.push('export type EngineMettaCert = z.infer<typeof EngineMettaCertSchema>;');
  lines.push('');

  // Engine Custom
  lines.push('export const EngineCustomQuerySchema = z.object({');
  lines.push('  engine: z.string(),');
  lines.push('  payload: z.any(),');
  lines.push('  timeoutMs: z.number().int().positive().optional(),');
  lines.push('});');
  lines.push('export type EngineCustomQuery = z.infer<typeof EngineCustomQuerySchema>;');
  lines.push('');

  lines.push('export const EngineCustomResultSchema = z.object({');
  lines.push('  result: z.any(),');
  lines.push('  statistics: z.object({');
  lines.push('    timeMs: z.number().int().nonnegative(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type EngineCustomResult = z.infer<typeof EngineCustomResultSchema>;');
  lines.push('');

  lines.push('export const EngineCustomCertSchema = z.object({');
  lines.push('  engine: z.string(),');
  lines.push('  payloadHash: z.string(),');
  lines.push('});');
  lines.push('export type EngineCustomCert = z.infer<typeof EngineCustomCertSchema>;');
  lines.push('');

  // Formalization NL to Formal
  lines.push('export const FormalizationNLToFormalQuerySchema = z.object({');
  lines.push('  text: z.string(),');
  lines.push('  context: z.record(z.string(), z.any()).optional(),');
  lines.push('});');
  lines.push('export type FormalizationNLToFormalQuery = z.infer<typeof FormalizationNLToFormalQuerySchema>;');
  lines.push('');

  lines.push('export const FormalizationNLToFormalResultSchema = z.object({');
  lines.push('  narsese: z.string(),');
  lines.push('  confidence: z.number().min(0).max(1),');
  lines.push('  ambiguities: z.array(z.object({');
  lines.push('    type: z.string(),');
  lines.push('    description: z.string(),');
  lines.push('    options: z.array(z.string()),');
  lines.push('    confidence: z.number().min(0).max(1),');
  lines.push('  })).optional(),');
  lines.push('});');
  lines.push('export type FormalizationNLToFormalResult = z.infer<typeof FormalizationNLToFormalResultSchema>;');
  lines.push('');

  lines.push('export const FormalizationNLToFormalCertSchema = z.object({');
  lines.push('  model: z.string().optional(),');
  lines.push('  textHash: z.string(),');
  lines.push('});');
  lines.push('export type FormalizationNLToFormalCert = z.infer<typeof FormalizationNLToFormalCertSchema>;');
  lines.push('');

  // Formalization Formal to NL
  lines.push('export const FormalizationFormalToNLQuerySchema = z.object({');
  lines.push('  narsese: z.string(),');
  lines.push('  context: z.record(z.string(), z.any()).optional(),');
  lines.push('});');
  lines.push('export type FormalizationFormalToNLQuery = z.infer<typeof FormalizationFormalToNLQuerySchema>;');
  lines.push('');

  lines.push('export const FormalizationFormalToNLResultSchema = z.object({');
  lines.push('  text: z.string(),');
  lines.push('  confidence: z.number().min(0).max(1),');
  lines.push('});');
  lines.push('export type FormalizationFormalToNLResult = z.infer<typeof FormalizationFormalToNLResultSchema>;');
  lines.push('');

  lines.push('export const FormalizationFormalToNLCertSchema = z.object({');
  lines.push('  model: z.string().optional(),');
  lines.push('  narseseHash: z.string(),');
  lines.push('});');
  lines.push('export type FormalizationFormalToNLCert = z.infer<typeof FormalizationFormalToNLCertSchema>;');
  lines.push('');

  return lines;
}