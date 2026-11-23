/**
 * MCP Resources — generated resources from genome schemas.
 */

import { KeyedRegistry } from '../../util/keyed-collection';
import type { MCPResource } from './types';
import type { HabitatConfig, HabitatPack, Scorecard } from '../../worlds/index';
import type { Artifact, ArtifactKind } from '../../admit/repertoire';
import type { Curriculum } from '../../admit/curriculum';
import type { MinedSchema } from '../../mining/schemas';
import { SenarsError } from '../../errors/senars-error';

/** Resource template for dynamic resources. */
export interface MCPResourceTemplate {
  /** URI template (e.g., "artifact://{id}"). */
  readonly uriTemplate: string;
  /** Name template. */
  readonly nameTemplate: string;
  /** Description template. */
  readonly descriptionTemplate?: string;
  /** MIME type. */
  readonly mimeType: string;
  /** Handler to resolve template. */
  readonly resolve: (params: Record<string, string>) => Promise<MCPResource>;
}

/** Template registration with metadata. */
interface TemplateRegistration {
  readonly uriTemplate: string;
  readonly template: MCPResourceTemplate;
}

/** Generated resource registry using KeyedRegistry. */
export class GeneratedResourceRegistry {
  readonly resources: KeyedRegistry<MCPResource>;
  readonly templates: KeyedRegistry<TemplateRegistration>;

  constructor() {
    this.resources = new KeyedRegistry<MCPResource>({
      keyOf: (r) => r.uri,
      onDuplicate: (uri) => { throw new SenarsError(`Resource '${uri}' already registered`, 'VALIDATION_ERROR', { uri }); },
    });
    this.templates = new KeyedRegistry<TemplateRegistration>({
      keyOf: (r) => r.uriTemplate,
      onDuplicate: (uriTemplate) => { throw new SenarsError(`Resource template '${uriTemplate}' already registered`, 'VALIDATION_ERROR', { uriTemplate }); },
    });
  }

  /** Register static resource. */
  registerResource(resource: MCPResource): void {
    this.resources.register(resource);
  }

  /** Register resource template. */
  registerResourceTemplate(template: MCPResourceTemplate): void {
    this.templates.register({ uriTemplate: template.uriTemplate, template });
  }

  /** Resolve resource (static or template). */
  async resolveResource(uri: string): Promise<MCPResource | null> {
    // Check static resources first
    const staticResource = this.resources.get(uri);
    if (staticResource) return staticResource;

    // Check templates
    for (const registration of this.templates.all()) {
      const params = matchTemplate(registration.uriTemplate, uri);
      if (params) {
        return await registration.template.resolve(params);
      }
    }

    return null;
  }

  /** Get all registered resource URIs. */
  getResourceUris(): string[] {
    return this.resources.keys();
  }

  /** Get all registered template URI templates. */
  getTemplateUris(): string[] {
    return this.templates.keys();
  }

  /** Clear all registrations. */
  clear(): void {
    this.resources.clear();
    this.templates.clear();
  }
}

/** Create generated resource registry instance. */
export function createGeneratedResourceRegistry(): GeneratedResourceRegistry {
  return new GeneratedResourceRegistry();
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