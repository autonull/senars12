import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { makeId } from '../utils';
import { type EmbeddingGenerator, createEmbeddingGenerator } from './embedding.js';
import type { EmbeddingLayer } from './links/EmbeddingLayer.js';

export interface EpisodeMetadata {
  timestamp: number;
  type: 'episode' | 'reflection' | 'observation';
  source: string;
  tags?: string[];

  [key: string]: unknown;
}

export interface Episode {
  id: string;
  text: string;
  metadata: EpisodeMetadata;
  relevance?: number;
}

export class TemporalEmbeddingMemory {
  private readonly embeddingLayer: EmbeddingLayer;
  private readonly embeddingGenerator: EmbeddingGenerator;
  private readonly episodesPath: string;
  private readonly episodeIndex = new Map<string, EpisodeMetadata>();

  constructor(embeddingLayer: EmbeddingLayer, episodesPath = '.cache/temporal-episodes') {
    this.embeddingLayer = embeddingLayer;
    this.embeddingGenerator = createEmbeddingGenerator(false);
    this.episodesPath = episodesPath;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.episodesPath, { recursive: true });
    await this.loadIndex();
  }

  async store(
    text: string,
    metadata: Omit<EpisodeMetadata, 'timestamp' | 'type'> & {
      type?: 'episode' | 'reflection' | 'observation';
    }
  ): Promise<void> {
    const embedding = await this.embeddingGenerator.generate(text);
    const id = makeId();
    const episodeMetadata: EpisodeMetadata = {
      ...metadata,
      timestamp: Date.now(),
      type: metadata.type ?? 'episode',
    } as EpisodeMetadata;

    await this.embeddingLayer.store({
      id,
      embedding,
      text,
      metadata: episodeMetadata,
    });

    this.episodeIndex.set(id, episodeMetadata);
    await this.persistIndex();
  }

  async queryRelevant(query: string, n = 10): Promise<Episode[]> {
    const queryEmbedding = await this.embeddingGenerator.generate(query);
    const results = await this.embeddingLayer.search(queryEmbedding, n);

    return results.map((r) => ({
      id: r.id,
      text: r.text,
      metadata: r.metadata as EpisodeMetadata,
      relevance: r.score,
    }));
  }

  async queryTemporal(timestamp: number, windowMs: number, n = 20): Promise<Episode[]> {
    const results = await this.embeddingLayer.getAll();

    return results
      .filter((ep) => Math.abs((ep.metadata as EpisodeMetadata).timestamp - timestamp) <= windowMs)
      .sort(
        (a, b) =>
          Math.abs((a.metadata as EpisodeMetadata).timestamp - timestamp) -
          Math.abs((b.metadata as EpisodeMetadata).timestamp - timestamp)
      )
      .slice(0, n)
      .map((r) => ({
        id: r.id,
        text: r.text,
        metadata: r.metadata as EpisodeMetadata,
      }));
  }

  async queryHybrid(query: string, timestamp: number, n = 20): Promise<Episode[]> {
    const semanticResults = await this.queryRelevant(query, n * 2);
    const temporalResults = await this.queryTemporal(timestamp, 3600000, n * 2);

    const combined = new Map<string, { episode: Episode; score: number }>();

    semanticResults.forEach((ep, i) => {
      const score = (1 - i / semanticResults.length) * 0.6;
      combined.set(ep.id, { episode: ep, score });
    });

    temporalResults.forEach((ep, i) => {
      const score = (1 - i / temporalResults.length) * 0.4;
      const existing = combined.get(ep.id);
      if (existing) {
        existing.score += score;
      } else {
        combined.set(ep.id, { episode: ep, score });
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map((x) => ({ ...x.episode, relevance: x.score }));
  }

  private async loadIndex(): Promise<void> {
    const indexPath = join(this.episodesPath, 'index.json');
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const data = JSON.parse(content) as Record<string, EpisodeMetadata>;
      for (const [id, metadata] of Object.entries(data)) {
        this.episodeIndex.set(id, metadata);
      }
    } catch {}
  }

  private async persistIndex(): Promise<void> {
    const indexPath = join(this.episodesPath, 'index.json');
    const data = Object.fromEntries(this.episodeIndex);
    await fs.writeFile(indexPath, JSON.stringify(data), 'utf-8');
  }
}

export function createTemporalEmbeddingMemory(
  embeddingLayer: EmbeddingLayer,
  episodesPath?: string
): TemporalEmbeddingMemory {
  return new TemporalEmbeddingMemory(embeddingLayer, episodesPath);
}
