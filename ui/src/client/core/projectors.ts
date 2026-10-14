/**
 * Projector registrations — each projector is a catalog entry using the framework's
 * defineCatalog. This replaces the hardcoded producer list in projectWorkspace.
 */

import { defineProjectorCatalog, type ProjectorContext, registerProjector, getProjector, projectorIds, getProjectors, resetProjectors, mergeProjectorFragments, mergeFragments } from '../framework/projector.js';
import type { WorkspaceFragment } from './workspace-projection.js';
import type { ChatMessage, CognitiveEvent } from '@senars/core';
import type { ReasoningBackend } from './reasoning-backend.js';
import { projectChat } from './workspace-projection.js';
import { projectReasoning } from './workspace-projection.js';
import { projectCognitiveEvents } from './workspace-projection.js';
import { projectDerivationRecords } from './workspace-projection.js';
import { claimId } from './workspace-projection.js';

/** Chat projector — projects the chat log to turn blocks + discourse links. */
export const chatProjector = {
  id: 'chat',
  project: (ctx: ProjectorContext): WorkspaceFragment => projectChat(ctx.messages),
};

/** Reasoning projector factory — one per backend. */
export function createReasoningProjector(backend: ReasoningBackend) {
  return {
    id: `reasoning:${backend.id}`,
    project: (ctx: ProjectorContext): WorkspaceFragment => {
      const messageIds = new Set(ctx.messages.map((m) => m.id));
      return projectReasoning(backend, messageIds);
    },
  };
}

/** Cognitive events projector — budget/gate blocks. */
export const cognitiveEventsProjector = {
  id: 'cognitive-events',
  project: (ctx: ProjectorContext): WorkspaceFragment =>
    ctx.cognitiveEvents?.length ? projectCognitiveEvents(ctx.cognitiveEvents) : { blocks: [], links: [], roots: [] },
};

/** Derivation records projector — full proof trees. */
export const derivationRecordsProjector = {
  id: 'derivation-records',
  project: (ctx: ProjectorContext): WorkspaceFragment => {
    if (!ctx.cognitiveEvents?.length) return { blocks: [], links: [], roots: [] };
    const known = new Set<string>(
      ctx.workspaceGraph.blocks.keys()
    );
    return projectDerivationRecords(ctx.cognitiveEvents, (term) => {
      const ref = claimId(term);
      return known.has(ref) ? ref : undefined;
    });
  },
};

/** All built-in projectors as a catalog (for type-safe access). */
export const BUILTIN_PROJECTORS = defineProjectorCatalog({
  chat: { label: 'Chat Log', project: chatProjector.project },
  'cognitive-events': { label: 'Cognitive Events', project: cognitiveEventsProjector.project },
  'derivation-records': { label: 'Derivation Records', project: derivationRecordsProjector.project },
} as const);

/** Register all built-in projectors into the global registry. */
export function registerBuiltinProjectors(backends: readonly ReasoningBackend[]): void {
  registerProjector(chatProjector);
  registerProjector(cognitiveEventsProjector);
  registerProjector(derivationRecordsProjector);
  for (const backend of backends) {
    registerProjector(createReasoningProjector(backend));
  }
}

// Re-export registry functions
export { registerProjector, getProjector, projectorIds, getProjectors, resetProjectors, mergeProjectorFragments, mergeFragments };