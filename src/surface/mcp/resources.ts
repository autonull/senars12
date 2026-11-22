/**
 * MCP Resources — generated resources from genome schemas.
 */

import type { MCPResource } from './types';
import type { HabitatConfig, HabitatPack, Scorecard } from '../../worlds/index';
import type { Artifact, ArtifactKind } from '../../admit/repertoire';
import type { Curriculum } from '../../admit/curriculum';
import type { MinedSchema } from '../../mining/schemas';

/** Generated resource registry. */
export interface GeneratedResourceRegistry {
  /** Resources by URI. */
  resources: Map<string, MCPResource>;
  /** Resource templates. */
  templates: Map<string, MCPResourceTemplate>;
}

/** Resource template for dynamic resources. */
export interface MCPResourceTemplate {
  /** URI template (e.g., "artifact://{id}"). */
  uriTemplate: string;
  /** Name template. */
  nameTemplate: string;
  /** Description template. */
  descriptionTemplate?: string;
  /** MIME type. */
  mimeType: string;
  /** Handler to resolve template. */
  resolve: (params: Record<string, string>) => Promise<MCPResource>;
}

/** Create generated resource registry. */
export function createGeneratedResourceRegistry(): GeneratedResourceRegistry {
  return {
    resources: new Map(),
    templates: new Map(),
  };
}

/** Register static resource. */
export function registerResource(registry: GeneratedResourceRegistry, resource: MCPResource): void {
  registry.resources.set(resource.uri, resource);
}

/** Register resource template. */
export function registerResourceTemplate(registry: GeneratedResourceRegistry, template: MCPResourceTemplate): void {
  registry.templates.set(template.uriTemplate, template);
}

/** Resolve resource (static or template). */
export async function resolveResource(
  registry: GeneratedResourceRegistry,
  uri: string
): Promise<MCPResource | null> {
  // Check static resources first
  const staticResource = registry.resources.get(uri);
  if (staticResource) return staticResource;

  // Check templates
  for (const template of registry.templates.values()) {
    const params = matchTemplate(template.uriTemplate, uri);
    if (params) {
      return await template.resolve(params);
    }
  }

  return null;
}

/** Match URI against template. */
function matchTemplate(template: string, uri: string): Record<string, string> | null {
  const regex = new RegExp('^' + template.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)') + '$');
  const match = uri.match(regex);
  if (!match) return null;
  return match.groups ?? {};
}

/** Generate world resources. */
export function generateWorldResources(
  habitats: HabitatConfig[],
  packs: HabitatPack[]
): { static: MCPResource[]; templates: MCPResourceTemplate[] } {
  const staticResources: MCPResource[] = [];
  const templates: MCPResourceTemplate[] = [];

  // Static habitat list
  staticResources.push({
    uri: 'world://habitats',
    name: 'All Habitats',
    description: 'List of all available habitats',
    mimeType: 'application/json',
  });

  // Static pack list
  staticResources.push({
    uri: 'world://packs',
    name: 'All Packs',
    description: 'List of all habitat packs',
    mimeType: 'application/json',
  });

  // Habitat template
  templates.push({
    uriTemplate: 'habitat://{id}',
    nameTemplate: 'Habitat: {id}',
    descriptionTemplate: 'Habitat configuration for {id}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `habitat://${params.id}`,
      name: `Habitat: ${params.id}`,
      mimeType: 'application/json',
    }),
  });

  // Habitat state template
  templates.push({
    uriTemplate: 'habitat://{id}/state',
    nameTemplate: 'Habitat State: {id}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `habitat://${params.id}/state`,
      name: `Habitat State: ${params.id}`,
      mimeType: 'application/json',
    }),
  });

  // Pack template
  templates.push({
    uriTemplate: 'pack://{id}',
    nameTemplate: 'Pack: {id}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `pack://${params.id}`,
      name: `Pack: ${params.id}`,
      mimeType: 'application/json',
    }),
  });

  // Scorecard template
  templates.push({
    uriTemplate: 'scorecard://{kind}/{id}',
    nameTemplate: 'Scorecard: {kind}/{id}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `scorecard://${params.kind}/${params.id}`,
      name: `Scorecard: ${params.kind}/${params.id}`,
      mimeType: 'application/json',
    }),
  });

  return { static: staticResources, templates };
}

/** Generate artifact resources. */
export function generateArtifactResources(): { static: MCPResource[]; templates: MCPResourceTemplate[] } {
  const staticResources: MCPResource[] = [];
  const templates: MCPResourceTemplate[] = [];

  staticResources.push({
    uri: 'artifact://list',
    name: 'All Artifacts',
    description: 'List of all admitted artifacts',
    mimeType: 'application/json',
  });

  templates.push({
    uriTemplate: 'artifact://{id}',
    nameTemplate: 'Artifact: {id}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `artifact://${params.id}`,
      name: `Artifact: ${params.id}`,
      mimeType: 'application/json',
    }),
  });

  templates.push({
    uriTemplate: 'artifact://{kind}/{status}',
    nameTemplate: 'Artifacts: {kind}/{status}',
    mimeType: 'application/json',
    resolve: async (params) => ({
      uri: `artifact://${params.kind}/${params.status}`,
      name: `Artifacts: ${params.kind}/${params.status}`,
      mimeType: 'application/json',
    }),
  });

  return { static: staticResources, templates };
}

/** Generate curriculum resources. */
export function generateCurriculumResources(): { static: MCPResource[]; templates: MCPResourceTemplate[] } {
  return {
    static: [{
      uri: 'curriculum://list',
      name: 'All Curricula',
      description: 'List of all generated curricula',
      mimeType: 'application/json',
    }],
    templates: [{
      uriTemplate: 'curriculum://{id}',
      nameTemplate: 'Curriculum: {id}',
      mimeType: 'application/json',
      resolve: async (params) => ({
        uri: `curriculum://${params.id}`,
        name: `Curriculum: ${params.id}`,
        mimeType: 'application/json',
      }),
    }],
  };
}

/** Generate mining resources. */
export function generateMiningResources(): { static: MCPResource[]; templates: MCPResourceTemplate[] } {
  return {
    static: [{
      uri: 'mining://schemas',
      name: 'Mined Schemas',
      description: 'All mined schemas',
      mimeType: 'application/json',
    }],
    templates: [{
      uriTemplate: 'mining://schema/{id}',
      nameTemplate: 'Schema: {id}',
      mimeType: 'application/json',
      resolve: async (params) => ({
        uri: `mining://schema/${params.id}`,
        name: `Schema: ${params.id}`,
        mimeType: 'application/json',
      }),
    }],
  };
}

/** All generated resources. */
export function generateAllResources(
  habitats: HabitatConfig[],
  packs: HabitatPack[]
): { static: MCPResource[]; templates: MCPResourceTemplate[] } {
  const world = generateWorldResources(habitats, packs);
  const artifact = generateArtifactResources();
  const curriculum = generateCurriculumResources();
  const mining = generateMiningResources();

  return {
    static: [...world.static, ...artifact.static, ...curriculum.static, ...mining.static],
    templates: [...world.templates, ...artifact.templates, ...curriculum.templates, ...mining.templates],
  };
}