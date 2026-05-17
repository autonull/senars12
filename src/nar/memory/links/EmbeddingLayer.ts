import type {Term} from '../../terms';
import {termsEqual} from '../../terms';
import type {LinkEntry} from './types.js';
import {Layer} from './Layer.js';
import {createEmbeddingGenerator} from '../embedding.js';

export interface EmbeddingLayerConfig {
	capacity: number;
	similarityThreshold: number;
	maxLinksPerConcept: number;
}

export class EmbeddingLayer extends Layer {
	private readonly similarityThreshold: number;
	private readonly embeddingGenerator = createEmbeddingGenerator();
	private readonly termEmbeddings = new Map<string, number[]>();

	constructor(config: EmbeddingLayerConfig) {
		super('semantic', config.capacity, 'priority');
		this.similarityThreshold = config.similarityThreshold ?? 0.6;
	}

	async indexConcept(term: Term): Promise<void> {
		try {
			const termText = term.toString();
			const embedding = await this.embeddingGenerator.generate(termText);
			this.termEmbeddings.set(termText, embedding);

			const similarTerms = await this.findSimilarTerms(term, 20);
			
			for (const similar of similarTerms) {
				if (similar.similarity >= this.similarityThreshold && similar.term !== termText) {
					this.add(0, 0, {
						sourceTerm: term,
						targetTerm: term,
						similarity: similar.similarity,
					});
				}
			}
		} catch (error) {
			console.warn('Embedding index failed:', error);
		}
	}

	async findSimilarTerms(queryTerm: Term, topK = 10): Promise<Array<{term: string; similarity: number}>> {
		try {
			const queryEmbedding = await this.embeddingGenerator.generate(queryTerm.toString());
			const results: Array<{term: string; similarity: number}> = [];

			for (const [term, embedding] of this.termEmbeddings) {
				const similarity = this.cosineSimilarity(queryEmbedding, embedding);
				if (similarity > 0) {
					results.push({term, similarity});
				}
			}

			results.sort((a, b) => b.similarity - a.similarity);
			return results.slice(0, topK);
		} catch {
			return [];
		}
	}

	override getLinksByTerm(term: Term): LinkEntry[] {
		return this.bag.getLinks().filter(link => 
			termsEqual(link.sourceTerm, term) || termsEqual(link.targetTerm, term)
		);
	}

	override removeAllLinksForTerm(term: Term): void {
		this.bag.removeLinksByTerm(term);
	}

	async removeConcept(term: Term): Promise<void> {
		const termText = term.toString();
		this.termEmbeddings.delete(termText);
		this.removeAllLinksForTerm(term);
	}

	override applyDecay(decayRate: number): void {
		super.applyDecay(decayRate);
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;
		let dot = 0, normA = 0, normB = 0;
		for (let i = 0; i < a.length; i++) {
			const ai = a[i] ?? 0;
			const bi = b[i] ?? 0;
			dot += ai * bi;
			normA += ai * ai;
			normB += bi * bi;
		}
		if (normA === 0 || normB === 0) return 0;
		return dot / (Math.sqrt(normA) * Math.sqrt(normB));
	}
}
