#!/usr/bin/env tsx
/**
 * Config Generator — produces TypeScript interfaces, JSON Schema, Markdown docs,
 * env docs, and Zod runtime schemas from the canonical config definitions.
 *
 * Run: `pnpm config:generate`
 * Outputs committed to `generated/config/`
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'generated', 'config');

mkdirSync(OUT_DIR, { recursive: true });

/** Dynamically load schemas to avoid circular dependency. */
async function loadSchemas(): Promise<Record<string, z.ZodSchema<any>>> {
  // Import from package alias to use the proper module graph
  const configModule = await import('@senars/config');
  const systemOneModule = await import('@senars/config/system-one');
  const dialogueModule = await import('@senars/config/dialogue');

  return {
    'app': configModule.appConfigSchema,
    'bot': configModule.botConfigSchema,
    'profile': configModule.botProfileSchema,
    'lm': configModule.lmSchema,
    'core': configModule.narCoreSchema,
    'memory': configModule.memorySchema,
    'inference': configModule.inferenceSchema,
    'backends': configModule.backendsSchema,
    'irc': configModule.ircSchema,
    'routing': configModule.routingSchema,
    'agent': configModule.agentSectionSchema,
    'connections': configModule.connectionsSchema,
    'systemOne': systemOneModule.systemOneSchema,
    'dialogue': dialogueModule.dialogueSchema,
  };
}

/** Convert a Zod schema to a TypeScript interface string. */
function zodToTs(schema: z.ZodSchema<any>, name: string, depth = 0): string {
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);

  // Unwrap ZodOptional, ZodDefault, ZodNullable, ZodTransform
  let innerSchema = schema;
  let isOptional = false;
  let isNullable = false;
  while (innerSchema) {
    if (innerSchema instanceof z.ZodOptional) {
      isOptional = true;
      innerSchema = innerSchema._def.innerType;
    } else if (innerSchema instanceof z.ZodDefault) {
      innerSchema = innerSchema._def.innerType;
    } else if (innerSchema instanceof z.ZodNullable) {
      isNullable = true;
      innerSchema = innerSchema._def.innerType;
    } else if (innerSchema.constructor?.name === 'ZodTransform' || innerSchema.constructor?.name === 'ZodPipe') {
      // Zod v4 uses ZodPipe for transform/refine chains
      innerSchema = innerSchema._def.in || innerSchema._def.schema;
    } else {
      break;
    }
  }

  if (innerSchema instanceof z.ZodObject) {
    const shape = innerSchema.shape;
    const keys = Object.keys(shape);
    if (keys.length === 0) return `${indent}${name}: {}`;
    const fields = keys.map((key) => {
      const field = shape[key];
      const fieldOptional = field instanceof z.ZodOptional || field instanceof z.ZodDefault;
      const fieldInner = fieldOptional ? field._def.innerType : field;
      const tsType = zodToTsType(fieldInner, `${name}.${key}`, depth + 1);
      return `${nextIndent}${key}${fieldOptional ? '?' : ''}: ${tsType};`;
    });
    let result = `{\n${fields.join('\n')}\n${indent}}`;
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  if (innerSchema instanceof z.ZodArray) {
    const elementType = zodToTsType(innerSchema.element, `${name}[]`, depth);
    let result = `${elementType}[]`;
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  if (innerSchema instanceof z.ZodUnion) {
    const types = innerSchema._def.options.map((opt) => zodToTsType(opt, name, depth));
    let result = types.join(' | ');
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  if (innerSchema instanceof z.ZodEnum) {
    const values = innerSchema._def?.values?.map((v: string) => `"${v}"`).join(' | ');
    if (values) {
      let result = values;
      if (isOptional) result += ' | undefined';
      if (isNullable) result += ' | null';
      return result;
    }
  }

  // Zod v4: check for native enum via constructor name
  if (innerSchema && innerSchema.constructor && innerSchema.constructor.name === 'ZodNativeEnum' && innerSchema._def?.values) {
    const values = Object.values(innerSchema._def.values).map((v: string) => `"${v}"`).join(' | ');
    let result = values;
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  if (innerSchema instanceof z.ZodRecord) {
    const keyType = zodToTsType(innerSchema.keyType, `${name}.key`, depth);
    const valueType = zodToTsType(innerSchema.valueType, `${name}.value`, depth);
    let result = `Record<${keyType}, ${valueType}>`;
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  // Primitive types
  if (innerSchema instanceof z.ZodString) {
    let result = 'string';
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }
  if (innerSchema instanceof z.ZodNumber) {
    let result = 'number';
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }
  if (innerSchema instanceof z.ZodBoolean) {
    let result = 'boolean';
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }
  if (innerSchema instanceof z.ZodBigInt) {
    let result = 'bigint';
    if (isOptional) result += ' | undefined';
    if (isNullable) result += ' | null';
    return result;
  }

  return 'unknown';
}

function zodToTsType(schema: z.ZodSchema<any>, name: string, depth = 0): string {
  // Delegate to zodToTs which handles unwrapping
  return zodToTs(schema, name, depth);
}

/** Generate TypeScript interfaces. */
function generateTs(schemas: Record<string, z.ZodSchema<any>>): string {
  const interfaces = Object.entries(schemas).map(([name, schema]) => {
    const ts = zodToTs(schema, name);
    return `export interface ${name.charAt(0).toUpperCase() + name.slice(1)}Config ${ts}`;
  });
  return `// Generated by config-generate.ts — DO NOT EDIT\n\n${interfaces.join('\n\n')}\n`;
}

/** Generate JSON Schema. */
function generateJsonSchema(schemas: Record<string, z.ZodSchema<any>>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    result[name] = zodToJsonSchema(schema);
  }
  return result;
}

function zodToJsonSchema(schema: z.ZodSchema<any>): any {
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  if (schema instanceof z.ZodBigInt) return { type: 'integer' };
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(schema.shape)) {
      const optional = field instanceof z.ZodOptional || field instanceof z.ZodDefault;
      const inner = optional ? field._def.innerType : field;
      properties[key] = zodToJsonSchema(inner);
      if (!optional) required.push(key);
    }
    return { type: 'object', properties, required, additionalProperties: false };
  }
  if (schema instanceof z.ZodOptional) return zodToJsonSchema(schema._def.innerType);
  if (schema instanceof z.ZodDefault) return zodToJsonSchema(schema._def.innerType);
  if (schema instanceof z.ZodNullable) return { ...zodToJsonSchema(schema._def.innerType), nullable: true };
  if (schema instanceof z.ZodUnion) {
    return { anyOf: schema._def.options.map(zodToJsonSchema) };
  }
  if (schema instanceof z.ZodEnum) {
    if (schema._def?.values) return { type: 'string', enum: schema._def.values };
  }
  // Zod v4: check for native enum via constructor name
  if (schema && schema.constructor && schema.constructor.name === 'ZodNativeEnum' && schema._def?.values) {
    return { type: 'string', enum: Object.values(schema._def.values) };
  }
  if (schema instanceof z.ZodRecord) {
    return { type: 'object', additionalProperties: zodToJsonSchema(schema.valueType) };
  }
  return { type: 'object' };
}

/** Generate Markdown documentation. */
function generateMarkdown(schemas: Record<string, z.ZodSchema<any>>): string {
  const sections = Object.entries(schemas).map(([name, schema]) => {
    const title = name.charAt(0).toUpperCase() + name.slice(1);
    return `## ${title} Config\n\n\`\`\`json\n${JSON.stringify(zodToJsonSchema(schema), null, 2)}\n\`\`\`\n`;
  });
  return `# SeNARS Configuration Reference\n\n*Generated by config-generate.ts — DO NOT EDIT*\n\n${sections.join('\n')}`;
}

/** Generate environment variable documentation. */
function generateEnvDocs(): string {
  const envVars = [
    { name: 'LM_PROFILE', description: 'LM profile to use (e.g., "production")', default: 'development' },
    { name: 'LM_PROVIDER', description: 'LM provider name', default: 'llamacpp-embedded' },
    { name: 'LM_LLAMACPP_MODEL', description: 'Path to llama.cpp model file', required: true },
    { name: 'LM_LLAMACPP_BASE_URL', description: 'llama.cpp server base URL', default: 'http://localhost:8080' },
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key (when using OpenAI provider)', required: false },
    { name: 'ANTHROPIC_API_KEY', description: 'Anthropic API key (when using Anthropic provider)', required: false },
    { name: 'SENARS_MCP_APPROVE', description: 'Require approval for mutating MCP tools', default: 'false' },
    { name: 'SENARS_CONFIG', description: 'Path to config file', default: 'senars.config.json' },
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', description: 'OpenTelemetry OTLP endpoint', required: false },
    { name: 'OTEL_SERVICE_NAME', description: 'Service name for telemetry', default: 'senars-cognitive-kernel' },
  ];

  const rows = envVars.map((v) =>
    `| ${v.name} | ${v.description} | ${v.required ? 'Yes' : 'No'} | ${v.default ?? '—'} |`
  ).join('\n');

  return `# Environment Variables\n\n*Generated by config-generate.ts — DO NOT EDIT*\n\n| Variable | Description | Required | Default |\n|----------|-------------|----------|---------|\n${rows}\n`;
}

/** Generate Zod runtime schemas (re-export barrel). */
function generateZodBarrel(schemas: Record<string, z.ZodSchema<any>>): string {
  const exports = Object.keys(schemas).map((name) =>
    `export { ${name.charAt(0).toUpperCase() + name.slice(1)}Config } from '../config/schema';`
  ).join('\n');
  return `// Generated by config-generate.ts — DO NOT EDIT\n\n${exports}\n`;
}

/** Main. */
async function main() {
  const schemas = await loadSchemas();
  writeFileSync(resolve(OUT_DIR, 'types.ts'), generateTs(schemas));
  writeFileSync(resolve(OUT_DIR, 'schema.json'), JSON.stringify(generateJsonSchema(schemas), null, 2));
  writeFileSync(resolve(OUT_DIR, 'config.md'), generateMarkdown(schemas));
  writeFileSync(resolve(OUT_DIR, 'env.md'), generateEnvDocs());
  writeFileSync(resolve(OUT_DIR, 'zod.ts'), generateZodBarrel(schemas));

  console.log(`✓ Generated config artifacts in ${OUT_DIR}`);
}

main();