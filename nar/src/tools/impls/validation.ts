import { isPlainObject } from '@senars/util';
import { ToolError } from '../../types';
import type { ToolSchema, ToolSchemaProperty } from '../types';

const checkers: Record<string, (value: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number',
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => isPlainObject(v),
};

const checkRange = (key: string, value: number, prop: ToolSchemaProperty): void => {
  if (prop.minimum !== undefined && value < prop.minimum)
    throw new ToolError(`Value for ${key} is below minimum: ${prop.minimum}`, {
      parameter: key,
      minimum: prop.minimum,
    });
  if (prop.maximum !== undefined && value > prop.maximum)
    throw new ToolError(`Value for ${key} exceeds maximum: ${prop.maximum}`, {
      parameter: key,
      maximum: prop.maximum,
    });
};

const checkText = (key: string, value: string, prop: ToolSchemaProperty): void => {
  if (prop.minLength !== undefined && value.length < prop.minLength)
    throw new ToolError(`String ${key} is too short`, {
      parameter: key,
      minLength: prop.minLength,
    });
  if (prop.maxLength !== undefined && value.length > prop.maxLength)
    throw new ToolError(`String ${key} is too long`, { parameter: key, maxLength: prop.maxLength });
  if (prop.pattern && !new RegExp(prop.pattern).test(value))
    throw new ToolError(`String ${key} does not match pattern: ${prop.pattern}`, {
      parameter: key,
      pattern: prop.pattern,
    });
  if (prop.enum && !prop.enum.includes(value))
    throw new ToolError(`String ${key} is not in allowed values`, {
      parameter: key,
      allowed: prop.enum,
    });
};

export const validateProp = (key: string, value: unknown, prop: ToolSchemaProperty): void => {
  if (checkers[prop.type]?.(value) === false)
    throw new ToolError(`Invalid type for ${key}: expected ${prop.type}`, {
      parameter: key,
      expected: prop.type,
      actual: typeof value,
    });
  if (prop.type === 'number' && typeof value === 'number') checkRange(key, value, prop);
  if (prop.type === 'string' && typeof value === 'string') checkText(key, value, prop);
};

export const validateToolArgs = (schema: ToolSchema, args: Record<string, unknown>): void => {
  if (!schema) return;
  for (const required of schema.required ?? [])
    if (!(required in args))
      throw new ToolError(`Missing required parameter: ${required}`, {
        tool: schema.type,
        parameter: required,
      });
  const declared = schema.properties ?? {};
  if (Object.keys(declared).length === 0) return;
  for (const [key, value] of Object.entries(args)) {
    const prop = declared[key];
    if (!prop)
      throw new ToolError(`Unknown parameter: ${key}`, { tool: schema.type, parameter: key });
    validateProp(key, value, prop);
  }
};
