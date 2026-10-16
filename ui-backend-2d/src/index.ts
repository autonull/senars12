import { Graph2DRenderer } from './graph2d-renderer.js';
import type { Graph2DRendererOptions } from './graph2d-renderer.js';

export { Graph2DRenderer } from './graph2d-renderer.js';
export type { Graph2DRendererOptions } from './graph2d-renderer.js';

export const createGraph2DRenderer = (
  options?: Graph2DRendererOptions,
): Graph2DRenderer => new Graph2DRenderer(options);
