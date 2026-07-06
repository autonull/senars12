/**
 * @file src/tools/EmbeddingTool.js
 * @description Tool for generating embeddings with safety features
 */

import { BaseTool } from '../BaseTool.js';
import { cosineSimilarity } from '../../util/math.js';

/**
 * Tool for generating embeddings from text content
 * Note: This is a simplified implementation; in a real system, you'd use actual embedding models
 */
export class EmbeddingTool extends BaseTool {
    constructor(config = {}) {
        super(config);
        this.name = 'EmbeddingTool';

        // Configure safety settings
        this.maxTextLength = config.maxTextLength || 10000; // 10k chars max
        this.maxBatchSize = config.maxBatchSize || 10; // Max items per batch
        this.timeout = config.timeout || 30000; // 30 seconds default
        this.defaultModel = config.defaultModel || 'default-embedding-model';
        this.defaultDimensions = config.defaultDimensions || 128;

        // For demonstration purposes, we'll simulate embedding generation
        // In a real system, you'd connect to actual embedding services
        this.availableModels = config.availableModels || [
            'default-embedding-model',
            'sentence-transformers/all-MiniLM-L6-v2',
            'openai/text-embedding-ada-002'
        ];
    }

    /**
     * Execute embedding generation tasks
     * @param {object} params - Tool parameters
     * @param {object} context - Execution context
     * @returns {Promise<any>} - Embedding result
     */
    async execute(params, context) {
        const {operation, text, texts, model = this.defaultModel, options = {}} = params;

        if (!operation) {throw new Error('Operation is required');}

        switch (operation.toLowerCase()) {
            case 'generate':
            case 'embed':
                return await this._handleEmbedOperation(text, texts, model, options);
            case 'compare':
                if (!text || !params.compareWith) {throw new Error('text and compareWith are required for compare operation');}
                return await this._compareEmbeddings(text, params.compareWith, model, options);
            case 'similarity':
                if (!text || !params.against) {throw new Error('text and against are required for similarity operation');}
                return await this._calculateSimilarity(text, params.against, model, options);
            case 'cluster':
                if (!texts) {throw new Error('texts array is required for cluster operation');}
                return await this._clusterEmbeddings(texts, model, options);
            case 'search':
                if (!text || !params.searchSpace) {throw new Error('text and searchSpace are required for search operation');}
                return await this._searchEmbeddings(text, params.searchSpace, model, options);
            default:
                throw new Error(`Unsupported operation: ${operation}. Supported operations: generate, embed, compare, similarity, cluster, search`);
        }
    }

    /**
     * Handle the embed operation (single or batch)
     * @private
     */
    async _handleEmbedOperation(text, texts, model, options) {
        if (!text && !texts) {throw new Error('Either text or texts array is required for embed operation');}
        if (text && texts) {throw new Error('Provide either text or texts array, not both');}

        return text
            ? this._generateEmbedding(text, model, options)
            : this._generateBatchEmbeddings(texts, model, options);
    }

    /**
     * Generate a single embedding
     * @private
     */
    async _generateEmbedding(text, model, options = {}) {
        // Validate the text
        this._validateText(text, 'input');

        // In a real implementation, you would call an actual embedding API
        // For this example, we'll simulate the embedding process
        const embedding = this._simulateEmbedding(text, model);

        return this._createEmbeddingResult('embed', model, text.length, embedding);
    }

    /**
     * Generate embeddings for a batch of texts
     * @private
     */
    async _generateBatchEmbeddings(texts, model, options = {}) {
        this._validateTextsArray(texts);

        // Generate embeddings for each text
        const embeddings = texts.map(text => ({
            text: text,
            embedding: this._simulateEmbedding(text, model),
            textLength: text.length
        }));

        return {
            success: true,
            operation: 'embed-batch',
            model,
            batchSize: texts.length,
            embeddings: embeddings,
            metadata: {
                model,
                totalInputLength: texts.reduce((sum, text) => sum + text.length, 0),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Compare two texts using embeddings
     * @private
     */
    async _compareEmbeddings(text1, text2, model, options = {}) {
        this._validateText(text1, 'text1');
        this._validateText(text2, 'text2');

        const embedding1 = this._simulateEmbedding(text1, model);
        const embedding2 = this._simulateEmbedding(text2, model);

        // Calculate cosine similarity
        const similarity = this._cosineSimilarity(embedding1, embedding2);

        return {
            success: true,
            operation: 'compare',
            model,
            similarity,
            text1Length: text1.length,
            text2Length: text2.length,
            embeddings: [embedding1, embedding2],
            metadata: {
                model,
                inputLength: text1.length + text2.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Calculate similarity between two texts
     * @private
     */
    async _calculateSimilarity(text, against, model, options = {}) {
        this._validateText(text, 'text');
        this._validateText(against, 'against');

        const textEmbedding = this._simulateEmbedding(text, model);
        const againstEmbedding = this._simulateEmbedding(against, model);

        // Calculate cosine similarity
        const similarity = this._cosineSimilarity(textEmbedding, againstEmbedding);

        return {
            success: true,
            operation: 'similarity',
            model,
            similarity,
            textLength: text.length,
            againstLength: against.length,
            metadata: {
                model,
                inputLength: text.length + against.length,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Cluster embeddings from a text array
     * @private
     */
    async _clusterEmbeddings(texts, model, options = {}) {
        this._validateTextsArray(texts, 'clustering');

        // Generate embeddings for all texts
        const embeddings = texts.map(text => ({
            text,
            embedding: this._simulateEmbedding(text, model),
            textLength: text.length
        }));

        // Simulate clustering (in a real implementation, you'd use actual clustering algorithms)
        const clusters = this._simulateClustering(embeddings, options);

        return {
            success: true,
            operation: 'cluster',
            model,
            clusters,
            totalTexts: texts.length,
            metadata: {
                model,
                totalInputLength: texts.reduce((sum, text) => sum + text.length, 0),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Search for similar texts in a search space
     * @private
     */
    async _searchEmbeddings(query, searchSpace, model, options = {}) {
        if (!Array.isArray(searchSpace)) {throw new Error('searchSpace must be an array');}
        this._validateText(query, 'query text');
        this._validateTextsArray(searchSpace, 'search space', this.maxBatchSize);

        // Generate embedding for the query
        const queryEmbedding = this._simulateEmbedding(query, model);

        // Calculate similarities with all items in search space
        const results = searchSpace.map((text, index) => {
            const textEmbedding = this._simulateEmbedding(text, model);
            const similarity = this._cosineSimilarity(queryEmbedding, textEmbedding);
            return {
                index,
                text,
                similarity,
                embedding: textEmbedding
            };
        });

        // Sort by similarity (descending)
        results.sort((a, b) => b.similarity - a.similarity);

        // Get top results if specified
        const topK = options.topK || 5;
        const topResults = results.slice(0, topK);

        return {
            success: true,
            operation: 'search',
            model,
            query,
            results: topResults,
            totalSearchSpace: searchSpace.length,
            queryLength: query.length,
            metadata: {
                model,
                topK,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get tool description
     */
    getDescription() {
        return 'Tool for generating text embeddings, comparing texts, calculating semantic similarity, clustering, and search. Includes safety limits on text length and batch size.';
    }

    /**
     * Get parameter schema
     */
    getParameterSchema() {
        return {
            type: 'object',
            properties: {
                operation: {
                    type: 'string',
                    enum: ['generate', 'embed', 'compare', 'similarity', 'cluster', 'search'],
                    description: 'The embedding operation to perform'
                },
                text: {
                    type: 'string',
                    description: 'Single text input'
                },
                texts: {
                    type: 'array',
                    items: {type: 'string'},
                    description: 'Multiple text inputs for batch operations'
                },
                model: {
                    type: 'string',
                    default: this.defaultModel,
                    description: 'Embedding model to use'
                },
                compareWith: {
                    type: 'string',
                    description: 'Text to compare with (for compare operation)'
                },
                against: {
                    type: 'string',
                    description: 'Text to compare against (for similarity operation)'
                },
                searchSpace: {
                    type: 'array',
                    items: {type: 'string'},
                    description: 'Texts to search through (for search operation)'
                },
                options: {
                    type: 'object',
                    properties: {
                        topK: {
                            type: 'number',
                            description: 'Number of top results to return (for search operation)',
                            minimum: 1,
                            maximum: 100
                        }
                    },
                    description: 'Additional options for the operation'
                }
            },
            required: ['operation']
        };
    }

    /**
     * Validate parameters
     */
    validate(params) {
        const validation = super.validate(params);
        const errors = [...(validation.errors || [])];

        if (!params.operation) {
            errors.push('Operation is required');
        } else if (!['generate', 'embed', 'compare', 'similarity', 'cluster', 'search'].includes(params.operation.toLowerCase())) {
            errors.push('Invalid operation. Must be one of: generate, embed, compare, similarity, cluster, search');
        }

        if (params.operation === 'generate' || params.operation === 'embed') {
            if (!params.text && !params.texts) {
                errors.push('Either text or texts array is required');
            }
            if (params.text && params.texts) {
                errors.push('Provide either text or texts array, not both');
            }
            if (params.texts && !Array.isArray(params.texts)) {
                errors.push('texts must be an array');
            }
        }

        if (params.operation === 'compare' && (!params.text || !params.compareWith)) {
            errors.push('text and compareWith are required for compare operation');
        }

        if (params.operation === 'similarity' && (!params.text || !params.against)) {
            errors.push('text and against are required for similarity operation');
        }

        if (params.operation === 'cluster' && !params.texts) {
            errors.push('texts array is required for cluster operation');
        }

        if (params.operation === 'search' && (!params.text || !params.searchSpace)) {
            errors.push('text and searchSpace are required for search operation');
        }

        if (params.operation === 'search' && params.options?.topK) {
            if (params.options.topK < 1 || params.options.topK > 100) {
                errors.push('topK must be between 1 and 100');
            }
        }

        // Validate text lengths if provided
        if (params.text) {
            try {
                this._validateText(params.text, 'input text');
            } catch (error) {
                errors.push(error.message);
            }
        }

        if (params.texts) {
            if (params.texts.length > this.maxBatchSize) {
                errors.push(`Batch size exceeds maximum limit: ${this.maxBatchSize}`);
            }
            for (let i = 0; i < params.texts.length; i++) {
                try {
                    this._validateText(params.texts[i], `text at index ${i}`);
                } catch (error) {
                    errors.push(`Text at index ${i}: ${error.message}`);
                }
            }
        }

        if (params.searchSpace) {
            if (params.searchSpace.length > this.maxBatchSize) {
                errors.push(`Search space size exceeds maximum limit: ${this.maxBatchSize}`);
            }
            for (let i = 0; i < params.searchSpace.length; i++) {
                try {
                    this._validateText(params.searchSpace[i], `search space text at index ${i}`);
                } catch (error) {
                    errors.push(`Search space text at index ${i}: ${error.message}`);
                }
            }
        }

        return {isValid: errors.length === 0, errors};
    }

    /**
     * Get tool capabilities
     */
    getCapabilities() {
        return ['text-embedding', 'semantic-similarity', 'text-comparison', 'text-clustering', 'semantic-search'];
    }

    /**
     * Get tool category
     */
    getCategory() {
        return 'embedding';
    }

    /**
     * Validate text for safety and size limits
     * @private
     */
    _validateText(text, context = 'input') {
        if (typeof text !== 'string') {
            throw new Error(`Text ${context} must be a string`);
        }

        if (text.length > this.maxTextLength) {
            throw new Error(`Text ${context} exceeds maximum length limit: ${this.maxTextLength} characters`);
        }

        // Additional safety checks could be added here
        return true;
    }

    /**
     * Validate a texts array with appropriate error messages
     * @private
     */
    _validateTextsArray(texts, context = '', maxBatchSize = this.maxBatchSize) {
        if (!Array.isArray(texts)) {
            throw new Error(`${context ? `${context} ` : ''}texts must be an array`);
        }

        if (texts.length > maxBatchSize) {
            throw new Error(`${context ? `${context} ` : ''}Batch size exceeds maximum limit: ${maxBatchSize}`);
        }

        for (let i = 0; i < texts.length; i++) {
            this._validateText(texts[i], `text at index ${i}${context ? ` for ${context}` : ''}`);
        }
    }

    /**
     * Create a standard embedding result object
     * @private
     */
    _createEmbeddingResult(operation, model, textLength, embedding) {
        return {
            success: true,
            operation,
            model,
            textLength: textLength,
            embeddingDimension: embedding.length,
            embedding: embedding,
            metadata: {
                model,
                inputLength: textLength,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Simulate embedding generation (in a real implementation, this would call an API)
     * @private
     */
    _simulateEmbedding(text, model) {
        // This is a very simplified simulation of embedding generation
        // In a real implementation, you would call actual embedding models

        // Create a deterministic "embedding" based on the text content
        const embedding = new Array(this.defaultDimensions).fill(0); // Standard embedding size (simplified)

        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const index = i % this.defaultDimensions;
            embedding[index] = (embedding[index] + charCode * (i + 1)) % 2 - 1; // Normalize to [-1, 1]
        }

        // Apply a simple hashing approach to make embeddings consistent for the same text
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash; // Convert to 32bit integer
        }

        // Apply the hash to modify the embedding slightly
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] = Math.tanh(embedding[i] + (hash >> i) % 100 / 1000);
        }

        return embedding;
    }

    /**
     * Simulate clustering of embeddings
     * @private
     */
    _simulateClustering(embeddings, options = {}) {
        // This is a simplified clustering simulation
        // In a real implementation, you'd use actual clustering algorithms like K-means, DBSCAN, etc.
        const clusters = [];
        const k = options.k || Math.min(3, embeddings.length);

        // For simplicity, we'll use a basic algorithm: group similar embeddings
        // In real implementation, use proper clustering algorithm
        for (let i = 0; i < k; i++) {
            clusters.push({
                id: i,
                texts: [],
                centroid: embeddings[i]?.embedding || new Array(this.defaultDimensions).fill(0),
                size: 0
            });
        }

        // Assign each embedding to the nearest cluster
        embeddings.forEach((item, idx) => {
            const clusterId = idx % k; // Simple assignment for simulation
            clusters[clusterId].texts.push(item.text);
            clusters[clusterId].size++;
        });

        return clusters;
    }

    /**
     * Calculate cosine similarity between two vectors
     * @private
     */
    _cosineSimilarity(vecA, vecB) {
        return cosineSimilarity(vecA, vecB);
    }
}