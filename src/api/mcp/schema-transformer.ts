/**
 * Schema Transformer
 * Converts Zod schemas to JSON Schema for MCP compliance
 */

import {z} from 'zod';
import {JSONSchema7} from 'json-schema';
import {CapabilityDescriptor, ValidationResult,} from './types.js';
import {errMsg} from '../../nar/utils/helpers.js';

/**
 * Schema transformation service
 * Handles conversion between internal Zod schemas and JSON Schema
 */
export class SchemaTransformer {
    /**
     * Convert Zod schema to JSON Schema
     * Uses Zod v4's built-in toJSONSchema method
     */
    toJSONSchema(schema: z.ZodSchema | unknown): JSONSchema7 {
        if (!schema) {
            return {
                type: 'object',
                properties: {},
            };
        }

        // If already a JSON Schema, return as-is
        if (this.isJSONSchema(schema)) {
            return schema as JSONSchema7;
        }

        // Handle Zod schemas - use built-in toJSONSchema for Zod v4
        if (this.isZodSchema(schema)) {
            try {
                // Zod v4 has built-in toJSONSchema
                const zodSchema = schema as z.ZodSchema;
                const result = (zodSchema as any).toJSONSchema?.();
                if (result) {
                    // Convert Draft 2020-12 to Draft 7 format if needed
                    return this.convertToDraft7(result) as JSONSchema7;
                }
            } catch (e) {
                console.error('Schema conversion failed:', e);
            }
        }

        // Fallback: return empty object schema
        return {
            type: 'object',
            properties: {},
        };
    }

    /**
     * Validate arguments against a Zod schema
     */
    validateArgs(
        args: unknown,
        schema: z.ZodSchema | JSONSchema7
    ): ValidationResult {
        try {
            // If Zod schema, use native parse
            if (this.isZodSchema(schema)) {
                const result = schema.safeParse(args);
                if (result.success) {
                    return {
                        isValid: true,
                        errors: [],
                        data: result.data,
                    };
                } else {
                    return {
                        isValid: false,
                        errors: ((result.error as any).issues || []).map((i: any) => String(i.message || i)),
                    };
                }
            }

            // If JSON Schema, we'd need a validator like ajv
            // For now, assume valid (MCP will validate)
            return {
                isValid: true,
                errors: [],
                data: args,
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [errMsg(error)],
            };
        }
    }

    /**
     * Transform capability descriptor with proper schema conversion
     */
    transformDescriptor(
        name: string,
        description: string,
        paramsSchema: z.ZodSchema,
        returnsSchema?: z.ZodSchema,
        metadata?: CapabilityDescriptor['metadata']
    ): CapabilityDescriptor {
        return {
            name,
            description,
            inputSchema: this.toJSONSchema(paramsSchema),
            outputSchema: returnsSchema ? this.toJSONSchema(returnsSchema) : undefined,
            metadata,
        };
    }

    /**
     * Convert JSON Schema Draft 2020-12 to Draft 7 format
     */
    private convertToDraft7(schema: any): JSONSchema7 {
        const converted: any = {...schema};

        // Remove Draft 2020-12 specific properties
        delete converted.$defs;
        delete converted.unevaluatedProperties;

        // Convert $defs to definitions if present
        if (schema.$defs) {
            converted.definitions = schema.$defs;
        }

        // Recursively convert nested schemas
        if (schema.properties) {
            converted.properties = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                converted.properties[key] = this.convertToDraft7(value);
            }
        }

        if (schema.items) {
            converted.items = this.convertToDraft7(schema.items);
        }

        return converted as JSONSchema7;
    }

    /**
     * Check if object is a Zod schema
     */
    private isZodSchema(schema: unknown): schema is z.ZodSchema {
        return (
            typeof schema === 'object' &&
            schema !== null &&
            '_def' in schema &&
            ('_def' in schema)
        );
    }

    /**
     * Check if object is already a JSON Schema
     */
    private isJSONSchema(schema: unknown): schema is JSONSchema7 {
        if (typeof schema !== 'object' || schema === null) {
            return false;
        }
        const obj = schema as Record<string, unknown>;
        // Check for JSON Schema indicators
        return (
            '$schema' in obj ||
            'type' in obj ||
            'properties' in obj ||
            'items' in obj
        );
    }
}

/**
 * Singleton instance for convenience
 */
let transformerInstance: SchemaTransformer | null = null;

export function getSchemaTransformer(): SchemaTransformer {
    if (!transformerInstance) {
        transformerInstance = new SchemaTransformer();
    }
    return transformerInstance;
}

/**
 * Utility function for quick conversion
 */
export function zodToMCPSchema(schema: z.ZodSchema): JSONSchema7 {
    return getSchemaTransformer().toJSONSchema(schema);
}
