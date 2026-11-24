/**
 * JSON Schema generation for the genome.
 */

import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_SCHEMA_DIR = join(__dirname, '..', '..', 'generated', 'json-schema');

mkdirSync(JSON_SCHEMA_DIR, { recursive: true });

export function writeJsonSchemas(): void {
  // This will be called after schemas.ts is generated
  // For now, it's a placeholder - the actual JSON schema generation
  // would use zod-to-json-schema or similar
  console.log('JSON Schema generation: not yet implemented');
}