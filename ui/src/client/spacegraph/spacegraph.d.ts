// Ambient type declarations for SpaceGraphJS (source-level import via Vite alias)
declare module 'spacegraphjs' {
  export interface SpaceGraphNode {
    id: string;
    object: { userData?: Record<string, unknown>; visible?: boolean };
    position: [number, number, number];
    data: Record<string, unknown>;
  }

  export interface SpaceGraphEdge {
    id: string;
    object: any;
    source: SpaceGraphNode;
    target: SpaceGraphNode;
    data: Record<string, unknown>;
  }

  export interface SpaceGraphCamera {
    position: [number, number, number];
    target: [number, number, number];
  }

  export interface SpaceGraphEvents {
    on(event: 'node:added', listener: (data: { node: SpaceGraphNode }) => void): void;
    on(
      event: 'node:updated',
      listener: (data: { node: SpaceGraphNode; changes: Record<string, unknown> }) => void
    ): void;
    on(event: 'node:removed', listener: (data: { id: string }) => void): void;
    on(event: 'preRender', listener: () => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export interface SpaceGraphRenderer {
    camera: { position: { length(): number } };
  }

  export interface SpaceGraphCameraControls {
    addEventListener(type: 'change', listener: () => void): void;
    removeEventListener(type: 'change', listener: () => void): void;
  }

  export class SpaceGraph {
    static instances: Set<SpaceGraph>;
    static create(
      container: HTMLElement | string,
      spec: { nodes: any[]; edges: any[] },
      options?: any
    ): Promise<SpaceGraph>;
    static load(container: HTMLElement | string, data: any, options?: any): Promise<SpaceGraph>;
    static quickGraph(
      container: HTMLElement | string,
      nodes: any[],
      edges?: any[],
      options?: any
    ): Promise<SpaceGraph>;
    static getContainerElement(container: string | HTMLElement): HTMLElement | null;

    container: HTMLElement;
    options: any;
    renderer: SpaceGraphRenderer;
    graph: any;
    pluginManager: any;
    cameraControls: SpaceGraphCameraControls;
    events: SpaceGraphEvents;
    vision: any;
    poolManager: any;
    input: any;
    ergo: any;
    nodeCount: number;
    edgeCount: number;
    isRendering: boolean;

    init(): Promise<void>;
    loadSpec(spec: any): this;
    update(spec: any): this;
    export(): any;
    import(data: any): this;
    getNode(id: string): SpaceGraphNode | undefined;
    getEdge(id: string): SpaceGraphEdge | undefined;
    removeNode(id: string): boolean;
    removeEdge(id: string): boolean;
    clear(): void;
    fitView(padding?: number, duration?: number): this;
    render(): this;
    pause(): void;
    resume(): this;
    dispose(): void;
    destroy(): void;
    layout(name: string, options?: any): Promise<void>;
    focusNode(id: string, padding?: number, duration?: number): this;
    center(x: number, y: number, z?: number): this;
    resetCamera(): this;
    setCamera(position: [number, number, number], target?: [number, number, number]): this;
    get camera(): SpaceGraphCamera;
    get cameraPosition(): [number, number, number];
    get cameraTarget(): [number, number, number];
    forNodes(callback: (node: SpaceGraphNode) => void): void;
    forEdges(callback: (edge: SpaceGraphEdge) => void): void;
    select(id: string): void;
    deselect(id: string): void;
    selectAll(): void;
    deselectAll(): void;
    nodes: Array<{ id: string; data?: any; object?: any }>;
  }

  export class ForceLayout {
    apply(options?: any): Promise<void>;
  }

  export class HtmlNode {
    static typeName: string;
    object: any;
    position: any;
    data: any;
    constructor(sg: SpaceGraph, spec: any);
    setSize(width: number, height: number, scaleContent?: boolean): this;
    setContentScale(scale: number): void;
    updateSpec(updates: any): this;
  }

  export class ShapeNode {
    object: any;
    position: any;
    data: any;
    constructor(sg: SpaceGraph, spec: any);
    updateSpec(updates: any): this;
  }

  export class Edge {
    object: any;
    source: any;
    target: any;
    data: any;
    constructor(sg: SpaceGraph, spec: any, source: any, target: any);
  }

  export class Wire {
    object: any;
    source: any;
    target: any;
    data: any;
    constructor(sg: SpaceGraph, spec: any, source: any, target: any);
  }

  export const VERSION: string;
  export const createSpaceGraph: (container: HTMLElement, options?: any) => SpaceGraph;
  export const sg: typeof createSpaceGraph;
}
