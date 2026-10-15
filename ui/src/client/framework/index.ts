/**
 * Framework — the shared substrate every app composes from.
 *
 * This re-exports the contribution + catalog + surface + app primitives. Individual
 * catalogs live in their domain modules (renderers, panels, blocks,
 * layers, lenses, events, fields, links, composer modes, embedded views).
 */

export type {
  Contribution,
} from './contribution.js';

export type {
  Catalog,
  CatalogDefinition,
  CatalogEntry,
  CatalogKey,
  CatalogEntryOf,
  KeyOf,
  EntryOf,
  FacetsOf,
} from './catalog.js';

export type {
  SurfaceDescriptor,
  Placement,
  Presentation,
  SurfaceBinding,
  SurfaceSource,
  SurfaceA11y,
} from './surface.js';

export type {
  FacetDescriptor,
  FacetKind,
  FacetGate,
  FacetData,
  FacetKey,
  FacetEntryOf,
} from './facet.js';

export type {
  IntentDescriptor,
  IntentKind,
  IntentPayload,
  SignalPayload,
  CommandArgs,
  IntentCatalog,
  IntentDispatch,
} from './intent.js';

export type {
  AppDescriptor,
  AppDefinition,
  AppLifecycle,
  AppContext,
  ConnectionConfig,
} from './app.js';

export type {
  Composition,
  Cell,
  Globals,
  LayoutId,
} from './composition.js';

export type {
  LayoutTemplate,
} from './layout.js';

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
} from './protocol.js';

export type {
  Projector,
  ProjectorContext,
  ProjectorEntry,
  ProjectorCatalogDefinition,
  ProjectorCatalog,
} from './projector.js';

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
} from './bundle.js';

export type {
  ValidationError,
  ValidationResult,
  ContributionValidator,
} from './validator.js';

export {
  createContribution,
  registerContribution,
  unregisterContribution,
} from './contribution.js';

export {
  defineCatalog,
  catalogFromContributions,
} from './catalog.js';

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
} from './surface.js';

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
} from './facet.js';

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
} from './intent.js';

export {
  defineApp,
  registerApp,
  appFor,
  getApps,
  appIds,
  appSurfaces,
  resolveConnectionConfig,
  APP_SHELL_TAG,
} from './app.js';

export {
  registerComposition,
  compositionFor,
  getCompositions,
  resetCompositions,
  cellSurface,
} from './composition.js';

export type {
  FocusKind,
  FocusRef,
  TaskType,
  TimeRef,
  Aspect,
  Depth,
  FocusCell,
} from './coordinates.js';

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
} from './coordinates.js';

export type { FocusStack } from './focus-stack.js';
export { createFocusStack } from './focus-stack.js';

export type {
  ContentSlice,
  ProvenanceSlice,
  HistorySlice,
  TraceSlice,
  FocusResolution,
  ResolverContext,
  Resolver,
  FocusSlice,
} from './resolver.js';

export { resolveFocus, workspaceResolver, aspectSlice, hasSlice } from './resolver.js';

export type { FidelityTier, AttentionClass, Allocation, AttentionItem } from './attention.js';

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
} from './attention.js';

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
} from './attention-runtime.js';

export {
  AREA_LETTERS,
  LAYOUT_IDS,
  layoutTemplate,
  layoutOf,
  areaName,
} from './layout.js';

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
} from './protocol.js';

export {
  defineProjectorCatalog,
  registerProjector,
  getProjector,
  projectorIds,
  getProjectors,
  resetProjectors,
  mergeProjectorFragments,
  mergeFragments,
} from './projector.js';

export {
  derived,
  derivedDeep,
  defaultEqual,
  setEqual,
  mapEqual,
  arrayEqual,
} from './derived.js';

export {
  defineBundle,
  registerBundle,
  bundleFor,
  getBundles,
  bundleIds,
  resetBundles,
  applyBundle,
} from './bundle.js';

export {
  createDefaultValidator,
  validateContribution,
  validateAllCatalogs,
  assertValid,
} from './validator.js';