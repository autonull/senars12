/**
 * Error Taxonomy (§P4.5).
 * Typed error classes per surface with recovery affordances.
 */

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
}

/** Base error class for all UI errors. */
export abstract class UiError extends Error {
  abstract readonly code: string;
  abstract readonly surface: string;
  abstract readonly severity: 'error' | 'warning' | 'info';
  abstract readonly recoverable: boolean;

  constructor(message: string, public readonly detail?: string) {
    super(message);
    this.name = this.constructor.name;
  }

  /** Get recovery actions for this error. */
  abstract getRecoveryActions(): RecoveryAction[];

  /** Convert to JSON for reporting. */
  toJSON(): object {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      detail: this.detail,
      surface: this.surface,
      severity: this.severity,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}

/** Connection errors. */
export class ConnectionError extends UiError {
  readonly code = 'CONNECTION_ERROR';
  readonly surface = 'ws-client';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Connection lost', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Retry', action: () => import('../core/ws-client.js').then(({ reconnect }) => reconnect()), variant: 'primary' },
      { label: 'Reload', action: () => window.location.reload(), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class ReconnectionError extends UiError {
  readonly code = 'RECONNECTION_FAILED';
  readonly surface = 'ws-client';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Failed to reconnect', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Retry', action: () => import('../core/ws-client.js').then(({ reconnect }) => reconnect()), variant: 'primary' },
      { label: 'Reload', action: () => window.location.reload(), variant: 'secondary' },
    ];
  }
}

/** Configuration errors. */
export class ConfigError extends UiError {
  readonly code = 'CONFIG_ERROR';
  readonly surface = 'config';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Invalid configuration', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Reset to Defaults', action: () => import('../core/config-schema.js').then(({ DEFAULT_UI_CONFIG, saveConfig }) => saveConfig(DEFAULT_UI_CONFIG)), variant: 'primary' },
      { label: 'Open Settings', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'settings' })), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class ConfigValidationError extends UiError {
  readonly code = 'CONFIG_VALIDATION_ERROR';
  readonly surface = 'config';
  readonly severity = 'warning' as const;
  readonly recoverable = true;

  constructor(message = 'Configuration validation failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Fix in Settings', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'settings' })), variant: 'primary' },
      { label: 'Reset Field', action: () => {}, variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Engine/Reasoning errors. */
export class EngineError extends UiError {
  readonly code = 'ENGINE_ERROR';
  readonly surface = 'nars-backend';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Reasoning engine error', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Restart Engine', action: () => import('../core/ws-client.js').then(({ send }) => send({ type: 'reset' })), variant: 'primary' },
      { label: 'Clear State', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('test:reset-all')), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class BudgetExhaustedError extends UiError {
  readonly code = 'BUDGET_EXHAUSTED';
  readonly surface = 'nars-backend';
  readonly severity = 'warning' as const;
  readonly recoverable = true;

  constructor(public readonly budgetType: string, message = 'Budget exhausted', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Increase Budget', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'settings' })), variant: 'primary' },
      { label: 'Continue Anyway', action: () => {}, variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class GateRejectedError extends UiError {
  readonly code = 'GATE_REJECTED';
  readonly surface = 'nars-backend';
  readonly severity = 'warning' as const;
  readonly recoverable = true;

  constructor(public readonly gate: string, message = 'Gate rejected', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'View Details', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'telemetry' })), variant: 'primary' },
      { label: 'Adjust Threshold', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'settings' })), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Projection/Rendering errors. */
export class ProjectionError extends UiError {
  readonly code = 'PROJECTION_ERROR';
  readonly surface = 'workspace-projection';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Workspace projection failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Retry Projection', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('test:step')), variant: 'primary' },
      { label: 'Reset View', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('view:fit')), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class GraphRenderError extends UiError {
  readonly code = 'GRAPH_RENDER_ERROR';
  readonly surface = 'graph-viewport';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Graph rendering failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Reset Graph', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('view:fit')), variant: 'primary' },
      { label: 'Switch Renderer', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'palette' })), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class LayoutError extends UiError {
  readonly code = 'LAYOUT_ERROR';
  readonly surface = 'graph-layout';
  readonly severity = 'warning' as const;
  readonly recoverable = true;

  constructor(message = 'Layout computation failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Try Different Layout', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'palette' })), variant: 'primary' },
      { label: 'Reset View', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('view:fit')), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Command/Input errors. */
export class CommandError extends UiError {
  readonly code = 'COMMAND_ERROR';
  readonly surface = 'commands';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Command failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Open Palette', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'palette' })), variant: 'primary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

export class CommandValidationError extends UiError {
  readonly code = 'COMMAND_VALIDATION_ERROR';
  readonly surface = 'commands';
  readonly severity = 'warning' as const;
  readonly recoverable = true;

  constructor(message = 'Invalid command arguments', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Open Palette', action: () => import('../core/events.js').then(({ eventBus }) => eventBus.emit('overlay:open', { id: 'palette' })), variant: 'primary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Data/Storage errors. */
export class StorageError extends UiError {
  readonly code = 'STORAGE_ERROR';
  readonly surface = 'storage';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Storage operation failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Clear Storage', action: () => { localStorage.clear(); window.location.reload(); }, variant: 'destructive' },
      { label: 'Reload', action: () => window.location.reload(), variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Network/API errors. */
export class NetworkError extends UiError {
  readonly code = 'NETWORK_ERROR';
  readonly surface = 'network';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'Network request failed', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Retry', action: () => {}, variant: 'primary' },
      { label: 'Check Connection', action: () => {}, variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Generic/Unknown errors. */
export class UnknownError extends UiError {
  readonly code = 'UNKNOWN_ERROR';
  readonly surface = 'unknown';
  readonly severity = 'error' as const;
  readonly recoverable = true;

  constructor(message = 'An unknown error occurred', detail?: string) {
    super(message, detail);
  }

  getRecoveryActions(): RecoveryAction[] {
    return [
      { label: 'Reload', action: () => window.location.reload(), variant: 'primary' },
      { label: 'Report Bug', action: () => { window.open('https://github.com/senars/senars/issues/new', '_blank'); }, variant: 'secondary' },
      { label: 'Dismiss', action: () => {}, variant: 'ghost' },
    ];
  }
}

/** Error factory for creating errors from plain objects. */
export function createError(error: { name?: string; code?: string; message: string; detail?: string; surface?: string }): UiError {
  const errorMap: Record<string, new (message: string, detail?: string) => UiError> = {
    ConnectionError,
    ReconnectionError,
    ConfigError,
    ConfigValidationError,
    EngineError,
    BudgetExhaustedError,
    GateRejectedError,
    ProjectionError,
    GraphRenderError,
    LayoutError,
    CommandError,
    CommandValidationError,
    StorageError,
    NetworkError,
  };

  if (error.code) {
    const Ctor = errorMap[error.code];
    if (Ctor) return new Ctor(error.message, error.detail);
  }

  if (error.name) {
    const Ctor = errorMap[error.name];
    if (Ctor) return new Ctor(error.message, error.detail);
  }

  // Fallback based on surface
  if (error.surface) {
    const surfaceErrors: Record<string, new (message: string, detail?: string) => UiError> = {
      'ws-client': ConnectionError,
      'config': ConfigError,
      'nars-backend': EngineError,
      'workspace-projection': ProjectionError,
      'graph-viewport': GraphRenderError,
      'graph-layout': LayoutError,
      'commands': CommandError,
      'storage': StorageError,
      'network': NetworkError,
    };
    const Ctor = surfaceErrors[error.surface];
    if (Ctor) {
      return new Ctor(error.message, error.detail);
    }
  }

  return new UnknownError(error.message, error.detail);
}

/** Emit an app-error event for the error boundary. */
export function emitError(error: UiError | Error): void {
  import('../core/events.js').then(({ eventBus }) => {
    if (error instanceof UiError) {
      eventBus.emit('app-error', { message: error.message, detail: error.detail, error: error.toJSON() });
    } else {
      eventBus.emit('app-error', { message: error.message, detail: error.stack });
    }
  });
}