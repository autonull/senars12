/**
 * Framework — the shared substrate every app composes from.
 *
 * This re-exports the contribution + catalog + surface + app primitives. Individual
 * catalogs live in their domain modules (renderers, panels, blocks,
 * layers, lenses, events, fields, links, composer modes, embedded views).
 */

export type {
  Contribution,
} from './contribution';

export type {
  Catalog,
  CatalogDefinition,
  CatalogEntry,
  CatalogKey,
  CatalogEntryOf,
  KeyOf,
  EntryOf,
  FacetsOf,
} from './catalog';

export type {
  SurfaceDescriptor,
  Placement,
  Presentation,
  SurfaceBinding,
  SurfaceSource,
  SurfaceA11y,
} from './surface';

export type {
  FacetDescriptor,
  FacetKind,
  FacetGate,
  FacetData,
  FacetKey,
  FacetEntryOf,
} from './facet';

export type {
  IntentDescriptor,
  IntentKind,
  IntentPayload,
  SignalPayload,
  CommandArgs,
  IntentCatalog,
  IntentDispatch,
} from './intent';

export type {
  AppDescriptor,
  AppDefinition,
  AppLifecycle,
  AppContext,
  ConnectionConfig,
} from './app';

export type {
  Composition,
  Cell,
  Globals,
  LayoutId,
} from './composition';

export type {
  LayoutTemplate,
} from './layout';

export type {
  MessageDirection,
  BaseMessageDescriptor,
  ServerMessageDescriptor,
  ClientMessageDescriptor,
  MessageDescriptor,
  ServerHandlerContext,
  ProtocolEntry,
  ProtocolDefinition,
  ProtocolCatalog,
  ProtocolKey,
} from './protocol';

export type {
  Projector,
  ProjectorContext,
  ProjectorEntry,
  ProjectorCatalogDefinition,
  ProjectorCatalog,
} from './projector';

export type {
  BundleDescriptor,
  BundleSurfaces,
  BundleViewAdapters,
  BundleFacets,
  BundleIntents,
  BundleProjectors,
  BundleProtocol,
  BundleBackends,
  BundleCapabilities,
  BundleConfigFields,
  ConfigFieldDescriptor,
} from './bundle';

export type {
  ValidationError,
  ValidationResult,
  ContributionValidator,
} from './validator';

export {
  createContribution,
  registerContribution,
  unregisterContribution,
} from './contribution';

export {
  defineCatalog,
  catalogFromContributions,
} from './catalog';

export {
  surfaceRegistry,
  registerSurface,
  surfaceFor,
  getSurfaces,
  surfacesWhere,
  surfaceIdsWhere,
  surfacesByPlacement,
  surfaceIdsByPlacement,
  surfaceTag,
  defaultPresentation,
  resolvedPresentation,
} from './surface';

export {
  defineFacetCatalog,
  createLensFacet,
  createLayerFacet,
  createModeFacet,
  createFilterFacet,
  facetKeysByKind,
  facetKeysByGate,
  availableFacets,
  isLensFacet,
  isLayerFacet,
  isModeFacet,
  isFilterFacet,
  registerFacet,
  facetFor,
  getFacets,
  facetIds,
  resetFacets,
} from './facet';

export {
  defineIntentCatalog,
  registerIntent,
  createIntent,
  signal,
  command,
  intent,
  intentFor,
  getIntents,
  intentIds,
  resetIntents,
  buildIntentCatalog,
} from './intent';

export {
  defineApp,
  registerApp,
  appFor,
  getApps,
  appIds,
  appSurfaces,
  resolveConnectionConfig,
  APP_SHELL_TAG,
} from './app';

export {
  registerComposition,
  compositionFor,
  getCompositions,
  resetCompositions,
  cellSurface,
  // Arrangement registry (unifies LayoutId, ArrangementKind, Shape)
  registerArrangement,
  getArrangement,
  getArrangements,
  hasArrangement,
  arrangementIds,
  resetArrangements,
  CORE_ARRANGEMENTS,
  registerCoreArrangements,
  type Arrangement,
  type ArrangementContext,
  type Layout,
  type RegisteredArrangement,
  arrangementsForLayout,
  arrangementsForShape,
} from './composition';

export type {
  FocusKind,
  FocusRef,
  TaskType,
  TimeRef,
  Aspect,
  Depth,
  FocusCell,
} from './coordinates';

export {
  focus,
  MIND_FOCUS,
  focusRefId,
  isTermFocus,
  focusKey,
  focusEquals,
  FOCUS_KINDS,
  isFocusKind,
  LIVE,
  atTime,
  timeRange,
  timeKey,
  ASPECTS,
  isAspect,
  ASPECT_SURFACES,
  DEPTHS,
  MAX_DEPTH,
  clampDepth,
  DEFAULT_ASPECT,
  cellFor,
  cellKey,
  cellEquals,
  FOCUS_FRAGMENT_PREFIX,
  encodeFocusFragment,
  decodeFocusFragment,
  // FocusKind registry (open)
  registerFocusKind,
  getFocusKind,
  getFocusKinds,
  hasFocusKind,
  focusKindIds,
  resetFocusKinds,
  CORE_FOCUS_KINDS,
  registerCoreFocusKinds,
  type FocusKindDescriptor,
  type RegisteredFocusKind,
  focusKindsForSubstrate,
  encodeFocusRef,
  decodeFocusRef,
  labelFocusRef,
  iconFocusRef,
} from './coordinates';

export type { FocusStack } from './focus-stack';
export { createFocusStack } from './focus-stack';

export type {
  ContentSlice,
  ProvenanceSlice,
  HistorySlice,
  TraceSlice,
  FocusResolution,
  ResolverContext,
  Resolver,
  FocusSlice,
} from './resolver';

export { resolveFocus, workspaceResolver, aspectSlice, hasSlice } from './resolver';

export {
  registerAspectProjection,
  getAspectProjection,
  getAspectProjections,
  hasAspectProjection,
  aspectProjectionIds,
  resetAspectProjections,
  CORE_ASPECTS,
  registerCoreAspects,
  type AspectProjector,
  type ProjectionContext,
  type RegisteredAspect,
  aspectsForFocus,
} from './aspect-registry';

export type {
  LinkPurpose,
} from './link-kinds';

export {
  LINK_KIND_PURPOSES,
  purposesOf,
  servesPurpose,
  kindsForPurpose,
  PROVENANCE_LINK_KINDS,
  HISTORY_LINK_KINDS,
  TRACE_LINK_KINDS,
  CONTAINMENT_LINK_KINDS,
  NEIGHBORHOOD_LINK_KINDS,
  THREAD_LINK_KINDS,
} from './link-kinds';

export type { FidelityTier, AttentionClass, Allocation, AttentionItem } from './attention';

export {
  tierRank,
  classify,
  tierCeiling,
  tierFor,
  DEFAULT_HALF_LIFE_MS,
  DEFAULT_ATTENTION_CAPACITY,
  RECLAIM_THRESHOLD,
  decayWeight,
  decayRateFor,
  TIER_COST,
  AttentionField,
} from './attention';

export {
  getAttentionField,
  attendFocus,
  releaseFocus,
  tierOf,
  tierToZoom,
  currentAllocations,
  resetAttentionField,
  attendMind,
  sampleAmbient,
  sampleAmbientMany,
} from './attention-runtime';

export {
  AREA_LETTERS,
  LAYOUT_IDS,
  layoutTemplate,
  layoutOf,
  areaName,
} from './layout';

export type {
  PerceivedPrompt,
  FormalizationCandidate,
} from './prompt-perception';

export {
  perceivePrompt,
  applyPerceivedPrompt,
  resolveTurn,
  heuristicFormalize,
  turnCellFromPerceived,
} from './prompt-perception';

// Re-export core workspace-graph types needed by prompt-perception
export {
  emptyWorkspaceGraph,
  applyWorkspaceOps,
  type WorkspaceGraph,
  type SemanticBlock,
  type SemanticLink,
  type WorkspaceOp,
  type Ref,
} from '../core/workspace-graph';

export {
  defineProtocolCatalog,
  serverMessage,
  clientMessage,
  createProtocolEntry,
  registerProtocol,
  protocolFor,
  getProtocols,
  protocolTypes,
  resetProtocols,
} from './protocol';

export {
  defineProjectorCatalog,
  registerProjector,
  getProjector,
  projectorIds,
  getProjectors,
  resetProjectors,
  mergeProjectorFragments,
  mergeFragments,
} from './projector';

export {
  derived,
  derivedDeep,
  defaultEqual,
  setEqual,
  mapEqual,
  arrayEqual,
} from './derived';

export {
  defineBundle,
  registerBundle,
  bundleFor,
  getBundles,
  bundleIds,
  resetBundles,
  applyBundle,
} from './bundle';

export {
  createDefaultValidator,
  validateContribution,
  validateAllCatalogs,
  assertValid,
} from './validator';