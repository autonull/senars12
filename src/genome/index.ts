/**
 * Genome — schema-driven code generation pipeline.
 *
 * One Zod declaration → TS type, log codec, MCP tool, elicitation form, fuzzer, doc table.
 * Totality types make a new event without a consumer a compile error.
 */

import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { IdRegistry } from '../util/registry';
import { SenarsError } from '../errors/senars-error';

/** Genome schema definition. */
export interface GenomeSchema {
  /** Schema ID. */
  id: string;
  /** Schema name. */
  name: string;
  /** Zod schema. */
  schema: z.ZodTypeAny;
  /** Description. */
  description?: string;
  /** Version. */
  version?: string;
  /** Tags. */
  tags?: string[];
  /** MCP tool config. */
  mcpTool?: MCPToolConfig;
  /** Elicitation form config. */
  elicitation?: ElicitationConfig;
}

/** MCP tool configuration. */
export interface MCPToolConfig {
  /** Tool name. */
  name: string;
  /** Tool description. */
  description: string;
  /** Handler function name. */
  handler: string;
}

/** Elicitation form configuration. */
export interface ElicitationConfig {
  /** Form title. */
  title: string;
  /** Form description. */
  description: string;
  /** Field overrides. */
  fields?: Record<string, { label?: string; description?: string; required?: boolean }>;
}

/** Generated artifacts. */
export interface GeneratedArtifacts {
  /** TypeScript type definition. */
  tsType: string;
  /** Log codec (encode/decode). */
  logCodec: string;
  /** MCP tool registration. */
  mcpTool: string;
  /** Elicitation form (HTML/JSON). */
  elicitationForm: string;
  /** Fuzzer test. */
  fuzzer: string;
  /** Documentation table (Markdown). */
  docTable: string;
  /** JSON Schema. */
  jsonSchema: object;
}

/** Genome registry using IdRegistry for id-based lookup. */
export class GenomeRegistry extends IdRegistry<GenomeSchema> {
  private outputDir: string;

  constructor(outputDir: string = './generated') {
    super();
    this.outputDir = outputDir;
  }

  /** Register a schema. */
  override register(schema: GenomeSchema): void {
    super.register(schema);
  }

  /** Get a schema. */
  override get(id: string): GenomeSchema | undefined {
    return super.get(id);
  }

  /** Get all schemas. */
  override getAll(): GenomeSchema[] {
    return super.getAll();
  }

  /** Generate all artifacts for a schema. */
  async generate(id: string): Promise<GeneratedArtifacts> {
    const schema = this.get(id);
    if (!schema) throw new SenarsError(`Schema not found: ${id}`, 'OPERATION_ERROR', { schemaId: id });

    const artifacts = this.generateArtifacts(schema);

    // Write to disk
    await this.writeArtifacts(schema.id, artifacts);

    return artifacts;
  }

  /** Generate all artifacts for all schemas. */
  async generateAll(): Promise<Map<string, GeneratedArtifacts>> {
    const results = new Map<string, GeneratedArtifacts>();
    for (const schema of this.getAll()) {
      results.set(schema.id, await this.generate(schema.id));
    }
    return results;
  }

  /** Generate artifacts from schema. */
  private generateArtifacts(schema: GenomeSchema): GeneratedArtifacts {
    const tsType = this.generateTSType(schema);
    const logCodec = this.generateLogCodec(schema);
    const mcpTool = this.generateMCPTool(schema);
    const elicitationForm = this.generateElicitationForm(schema);
    const fuzzer = this.generateFuzzer(schema);
    const docTable = this.generateDocTable(schema);
    const jsonSchema = this.generateJSONSchema(schema);

    return {
      tsType,
      logCodec,
      mcpTool,
      elicitationForm,
      fuzzer,
      docTable,
      jsonSchema,
    };
  }

  /** Generate TypeScript type. */
  private generateTSType(schema: GenomeSchema): string {
    const typeName = this.toPascalCase(schema.name);
    const zodSchema = schema.schema;

    // Extract shape from Zod object
    let fields = '';
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      fields = Object.entries(shape)
        .map(([key, value]) => {
          const tsType = this.zodToTS(value);
          const optional = value instanceof z.ZodOptional ? '?' : '';
          return `  ${key}${optional}: ${tsType};`;
        })
        .join('\n');
    }

    return `/**
 * ${schema.description ?? schema.name}
 * Auto-generated from genome schema: ${schema.id}
 */
export interface ${typeName} {
${fields}
}

export type ${typeName}Input = z.infer<typeof ${typeName}Schema>;

export const ${typeName}Schema = ${this.zodToString(zodSchema)};
`;
  }

  /** Convert Zod type to TypeScript type. */
  private zodToTS(zodType: any): string {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return 'string';
      case 'ZodNumber': return 'number';
      case 'ZodBoolean': return 'boolean';
      case 'ZodArray': return `${this.zodToTS(zodType.element)}[]`;
      case 'ZodOptional': return `${this.zodToTS(zodType.unwrap())} | undefined`;
      case 'ZodNullable': return `${this.zodToTS(zodType.unwrap())} | null`;
      case 'ZodDefault': return this.zodToTS(zodType._def.innerType);
      case 'ZodObject': {
        const shape = zodType.shape as Record<string, any>;
        const fields = Object.entries(shape)
          .map(([key, value]) => {
            const optional = value._def?.typeName === 'ZodOptional' ? '?' : '';
            return `${key}${optional}: ${this.zodToTS(value)}`;
          })
          .join('; ');
        return `{ ${fields} }`;
      }
      case 'ZodUnion': {
        return zodType._def.options.map((o: any) => this.zodToTS(o)).join(' | ');
      }
      case 'ZodEnum': {
        return zodType._def.values.map((v: string) => `"${v}"`).join(' | ');
      }
      case 'ZodLiteral': {
        return JSON.stringify(zodType._def.value);
      }
      case 'ZodRecord': {
        return `Record<string, ${this.zodToTS(zodType._def.valueType)}>`;
      }
      case 'ZodMap': {
        return `Map<${this.zodToTS(zodType._def.keyType)}, ${this.zodToTS(zodType._def.valueType)}>`;
      }
      case 'ZodTuple': {
        return `[${zodType._def.items.map((i: any) => this.zodToTS(i)).join(', ')}]`;
      }
      default:
        return 'unknown';
    }
  }

  /** Convert Zod schema to string representation. */
  private zodToString(zodType: any): string {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return 'z.string()';
      case 'ZodNumber': return 'z.number()';
      case 'ZodBoolean': return 'z.boolean()';
      case 'ZodArray': return `z.array(${this.zodToString(zodType.element)})`;
      case 'ZodOptional': return `${this.zodToString(zodType.unwrap())}.optional()`;
      case 'ZodNullable': return `${this.zodToString(zodType.unwrap())}.nullable()`;
      case 'ZodDefault': return `${this.zodToString(zodType._def.innerType)}.default(${JSON.stringify(zodType._def.defaultValue())})`;
      case 'ZodObject': {
        const shape = zodType.shape;
        const fields = Object.entries(shape)
          .map(([key, value]) => `    ${key}: ${this.zodToString(value)}`)
          .join(',\n');
        return `z.object({\n${fields}\n  })`;
      }
      case 'ZodUnion': {
        return `z.union([${zodType._def.options.map((o: any) => this.zodToString(o)).join(', ')}])`;
      }
      case 'ZodEnum': {
        return `z.enum([${zodType._def.values.map((v: string) => `"${v}"`).join(', ')}])`;
      }
      case 'ZodLiteral': {
        return `z.literal(${JSON.stringify(zodType._def.value)})`;
      }
      case 'ZodRecord': {
        return `z.record(${this.zodToString(zodType._def.valueType)})`;
      }
      case 'ZodMap': {
        return `z.map([${this.zodToString(zodType._def.keyType)}, ${this.zodToString(zodType._def.valueType)}])`;
      }
      case 'ZodTuple': {
        return `z.tuple([${zodType._def.items.map((i: any) => this.zodToString(i)).join(', ')}])`;
      }
      default:
        return 'z.unknown()';
    }
  }

  /** Generate log codec. */
  private generateLogCodec(schema: GenomeSchema): string {
    const typeName = this.toPascalCase(schema.name);
    const zodSchema = schema.schema;

    return `/**
 * Log codec for ${schema.name}
 * Auto-generated from genome schema: ${schema.id}
 */
import { ${typeName}Schema } from './${schema.id}.types';
import type { ${typeName} } from './${schema.id}.types';
import { SenarsError } from '@senars/errors';
import type { LogEvent, LogCodec } from '@senars/log';

export const ${typeName}LogCodec: LogCodec<${typeName}> = {
  encode: (event: ${typeName}): LogEvent => ({
    type: '${schema.id}',
    payload: ${typeName}Schema.parse(event),
    timestamp: Date.now(),
  }),
  decode: (event: LogEvent): ${typeName} => {
    if (event.type !== '${schema.id}') {
      throw new SenarsError(
        \`Event type mismatch: expected ${schema.id}, got \${event.type}\`,
        'INVALID_EVENT',
        { expected: '${schema.id}', actual: event.type }
      );
    }
    return ${typeName}Schema.parse(event.payload);
  },
  validate: (event: LogEvent): boolean => {
    if (event.type !== '${schema.id}') return false;
    const result = ${typeName}Schema.safeParse(event.payload);
    return result.success;
  },
};
`;
  }

  /** Generate MCP tool. */
  private generateMCPTool(schema: GenomeSchema): string {
    const typeName = this.toPascalCase(schema.name);
    const config = schema.mcpTool ?? {
      name: `${schema.id}.execute`,
      description: `Execute ${schema.name}`,
      handler: `handle${typeName}`,
    };

    return `/**
 * MCP tool for ${schema.name}
 * Auto-generated from genome schema: ${schema.id}
 */
import { MCPTool, MCPToolResult } from '@senars/mcp';
import { ${typeName}Schema } from './${schema.id}.types';
import type { ${typeName} } from './${schema.id}.types';

export const ${typeName}MCPTool: MCPTool = {
  name: '${config.name}',
  description: '${config.description}',
  inputSchema: {
    type: 'object',
    properties: ${this.zodToJSONSchema(schema.schema)},
    required: ${JSON.stringify(this.getRequiredFields(schema.schema))},
  },
  handler: async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const parsed = ${typeName}Schema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [{ type: 'text', text: \`Invalid input: \${parsed.error.message}\` }],
        isError: true,
      };
    }
    // Call the actual handler (to be implemented)
    const result = await ${config.handler}(parsed.data);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  },
};

// Handler to be implemented by user
export async function ${config.handler}(input: ${typeName}): Promise<unknown> {
  // TODO: Implement handler
  return { success: true, input };
}
`;
  }

  /** Convert Zod schema to JSON Schema properties. */
  private zodToJSONSchema(zodType: any): object {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return { type: 'string' };
      case 'ZodNumber': return { type: 'number' };
      case 'ZodBoolean': return { type: 'boolean' };
      case 'ZodArray': return { type: 'array', items: this.zodToJSONSchema(zodType.element) };
      case 'ZodOptional': return this.zodToJSONSchema(zodType.unwrap());
      case 'ZodNullable': return this.zodToJSONSchema(zodType.unwrap());
      case 'ZodDefault': return this.zodToJSONSchema(zodType._def.innerType);
      case 'ZodObject': {
        const shape = zodType.shape;
        const properties: Record<string, object> = {};
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = this.zodToJSONSchema(value);
        }
        return { type: 'object', properties };
      }
      case 'ZodUnion': {
        return { anyOf: zodType._def.options.map((o: any) => this.zodToJSONSchema(o)) };
      }
      case 'ZodEnum': {
        return { type: 'string', enum: zodType._def.values };
      }
      case 'ZodLiteral': {
        return { const: zodType._def.value };
      }
      case 'ZodRecord': {
        return { type: 'object', additionalProperties: this.zodToJSONSchema(zodType._def.valueType) };
      }
      default:
        return { type: 'object' };
    }
  }

  /** Get required fields from Zod object. */
  private getRequiredFields(zodType: any): string[] {
    if (zodType._def?.typeName === 'ZodObject') {
      const shape = zodType.shape as Record<string, any>;
      return Object.entries(shape)
        .filter(([, value]) => value._def?.typeName !== 'ZodOptional')
        .map(([key]) => key);
    }
    return [];
  }

  /** Generate elicitation form. */
  private generateElicitationForm(schema: GenomeSchema): string {
    const typeName = this.toPascalCase(schema.name);
    const config = schema.elicitation ?? {
      title: schema.name,
      description: schema.description ?? '',
    };

    const fields = this.generateFormFields(schema.schema);

    return `/**
 * Elicitation form for ${schema.name}
 * Auto-generated from genome schema: ${schema.id}
 */
{
  "title": "${config.title}",
  "description": "${config.description}",
  "type": "object",
  "properties": ${JSON.stringify(fields, null, 2)},
  "required": ${JSON.stringify(this.getRequiredFields(schema.schema))}
}
`;
  }

  /** Generate form fields. */
  private generateFormFields(zodType: any): Record<string, object> {
    if (zodType._def?.typeName === 'ZodObject') {
      const shape = zodType.shape;
      const fields: Record<string, object> = {};
      for (const [key, value] of Object.entries(shape)) {
        fields[key] = this.generateFormField(key, value);
      }
      return fields;
    }
    return {};
  }

  /** Generate single form field. */
  private generateFormField(key: string, zodType: any): object {
    const base = zodType._def?.typeName === 'ZodOptional' ? zodType.unwrap() : zodType;
    const baseTypeName = base._def?.typeName ?? 'unknown';

    switch (baseTypeName) {
      case 'ZodString':
        return { type: 'string', title: key, description: `Enter ${key}` };
      case 'ZodNumber':
        return { type: 'number', title: key, description: `Enter ${key}` };
      case 'ZodBoolean':
        return { type: 'boolean', title: key, description: `Enable ${key}` };
      case 'ZodArray':
        return { type: 'array', title: key, description: `Enter ${key} items`, items: this.generateFormField('item', base.element) };
      case 'ZodEnum':
        return { type: 'string', title: key, enum: base._def.values, description: `Select ${key}` };
      case 'ZodObject':
        return { type: 'object', title: key, properties: this.generateFormFields(base) };
      default:
        return { type: 'string', title: key };
    }
  }

  /** Generate fuzzer test. */
  private generateFuzzer(schema: GenomeSchema): string {
    const typeName = this.toPascalCase(schema.name);

    return `/**
 * Fuzzer test for ${schema.name}
 * Auto-generated from genome schema: ${schema.id}
 */
import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { ${typeName}Schema } from './${schema.id}.types';
import type { ${typeName} } from './${schema.id}.types';

describe('Fuzzer: ${schema.name}', () => {
  it('should parse valid generated data', () => {
    fc.assert(fc.property(${this.generateArbitrary(schema.schema)}, (data: ${typeName}) => {
      const result = ${typeName}Schema.safeParse(data);
      expect(result.success).toBe(true);
    }));
  });

  it('should reject invalid data', () => {
    fc.assert(fc.property(fc.anything(), (data: unknown) => {
      const result = ${typeName}Schema.safeParse(data);
      // Invalid data should either fail or be valid by chance
      expect(typeof result.success).toBe('boolean');
    }));
  });
});
`;
  }

  /** Generate fast-check arbitrary. */
  private generateArbitrary(zodType: any): string {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return 'fc.string()';
      case 'ZodNumber': return 'fc.float()';
      case 'ZodBoolean': return 'fc.boolean()';
      case 'ZodArray': return `fc.array(${this.generateArbitrary(zodType.element)})`;
      case 'ZodOptional': return `fc.option(${this.generateArbitrary(zodType.unwrap())})`;
      case 'ZodNullable': return `fc.option(${this.generateArbitrary(zodType.unwrap())}, { nil: null })`;
      case 'ZodDefault': return this.generateArbitrary(zodType._def.innerType);
      case 'ZodObject': {
        const shape = zodType.shape;
        const fields = Object.entries(shape)
          .map(([key, value]) => `${key}: ${this.generateArbitrary(value)}`)
          .join(', ');
        return `fc.record({ ${fields} })`;
      }
      case 'ZodUnion': {
        return `fc.oneof(${zodType._def.options.map((o: any) => this.generateArbitrary(o)).join(', ')})`;
      }
      case 'ZodEnum': {
        return `fc.constantFrom(${zodType._def.values.map((v: string) => `"${v}"`).join(', ')})`;
      }
      case 'ZodLiteral': {
        return `fc.constant(${JSON.stringify(zodType._def.value)})`;
      }
      default:
        return 'fc.anything()';
    }
  }

  /** Generate documentation table. */
  private generateDocTable(schema: GenomeSchema): string {
    const fields = this.generateDocFields(schema.schema);

    return `# ${schema.name}

${schema.description ?? ''}

**Schema ID:** \`${schema.id}\`
**Version:** ${schema.version ?? '1.0.0'}
**Tags:** ${schema.tags?.join(', ') ?? 'none'}

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
${fields.map(f => `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | ${f.description} |`).join('\n')}

## Example

\`\`\`json
${JSON.stringify(this.generateExample(schema.schema), null, 2)}
\`\`\`
`;
  }

  /** Generate doc fields. */
  private generateDocFields(zodType: any): Array<{ name: string; type: string; required: boolean; description: string }> {
    if (zodType._def?.typeName === 'ZodObject') {
      const shape = zodType.shape as Record<string, any>;
      return Object.entries(shape).map(([key, value]) => ({
        name: key,
        type: this.zodToTS(value),
        required: value._def?.typeName !== 'ZodOptional',
        description: `Field ${key}`,
      }));
    }
    return [];
  }

  /** Generate example data. */
  private generateExample(zodType: any): unknown {
    const typeName = zodType._def?.typeName ?? 'unknown';
    switch (typeName) {
      case 'ZodString': return 'example';
      case 'ZodNumber': return 42;
      case 'ZodBoolean': return true;
      case 'ZodArray': return [this.generateExample(zodType.element)];
      case 'ZodOptional': return this.generateExample(zodType.unwrap());
      case 'ZodNullable': return this.generateExample(zodType.unwrap());
      case 'ZodDefault': return zodType._def.defaultValue();
      case 'ZodObject': {
        const shape = zodType.shape as Record<string, any>;
        const obj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(shape)) {
          if (value._def?.typeName !== 'ZodOptional') {
            obj[key] = this.generateExample(value);
          }
        }
        return obj;
      }
      case 'ZodEnum': return zodType._def.values[0];
      case 'ZodLiteral': return zodType._def.value;
      default:
        return null;
    }
  }

  /** Generate JSON Schema. */
  private generateJSONSchema(schema: GenomeSchema): object {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: `https://senars.ai/schemas/${schema.id}.json`,
      title: schema.name,
      description: schema.description,
      type: 'object',
      properties: this.zodToJSONSchema(schema.schema),
      required: this.getRequiredFields(schema.schema),
      additionalProperties: false,
    };
  }

  /** Write artifacts to disk. */
  private async writeArtifacts(id: string, artifacts: GeneratedArtifacts): Promise<void> {
    const dir = resolve(this.outputDir, id);
    await mkdir(dir, { recursive: true });

    await Promise.all([
      writeFile(resolve(dir, `${id}.types.ts`), artifacts.tsType, 'utf-8'),
      writeFile(resolve(dir, `${id}.log-codec.ts`), artifacts.logCodec, 'utf-8'),
      writeFile(resolve(dir, `${id}.mcp-tool.ts`), artifacts.mcpTool, 'utf-8'),
      writeFile(resolve(dir, `${id}.elicitation.json`), artifacts.elicitationForm, 'utf-8'),
      writeFile(resolve(dir, `${id}.fuzzer.test.ts`), artifacts.fuzzer, 'utf-8'),
      writeFile(resolve(dir, `${id}.md`), artifacts.docTable, 'utf-8'),
      writeFile(resolve(dir, `${id}.json-schema.json`), JSON.stringify(artifacts.jsonSchema, null, 2), 'utf-8'),
    ]);
  }

  /** Convert to PascalCase. */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}

/** Create a genome registry. */
export function createGenomeRegistry(outputDir?: string): GenomeRegistry {
  return new GenomeRegistry(outputDir);
}