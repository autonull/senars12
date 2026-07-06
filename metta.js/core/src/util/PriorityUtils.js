/**
 * Priority calculation utilities for SeNARS
 * Following AGENTS.md guidelines for elegant, consolidated, consistent, organized, and DRY code
 */

import { clamp } from './math.js';
import { RuntimeError } from './error.js';

/**
 * Priority calculator class for configurable priority calculations
 */
export class PriorityCalculator {
    /**
     * Calculate priority based on configurable weights and factors
     * @param {Object} factors - Priority factors
     * @param {Object} weights - Weight configuration
     * @param {Object} options - Additional options
     * @returns {number} Calculated priority
     */
    static calculate(factors = {}, weights = {}, options = {}) {
        const {
            activationWeight = 0.3,
            confidenceWeight = 0.2,
            complexityWeight = 0.1,
            recencyWeight = 0.1,
            taskTypeWeight = 0.1,
            qualityWeight = 0.2,
            maxPriority = 1.0
        } = weights;
        
        const {
            normalize = true,
            minPriority = 0
        } = options;
        
        const {
            activation = 0,
            confidence = 0,
            complexity = 0,
            recency = 0,
            taskTypeFactor = 1, // Factor based on task type (goal vs belief vs question)
            quality = 0
        } = factors;
        
        let priority = 
            (activation * activationWeight) +
            (confidence * confidenceWeight) +
            (complexity * complexityWeight) +
            (recency * recencyWeight) +
            (taskTypeFactor * taskTypeWeight) +
            (quality * qualityWeight);
        
        if (normalize) {
            priority = clamp(priority, minPriority, maxPriority);
        }
        
        return priority;
    }
    
    /**
     * Calculate priority for an input task
     * @param {Object} inputFactors - Factors specific to input processing
     * @param {Object} config - Configuration for input priority calculation
     * @returns {number} Calculated input priority
     */
    static calculateInputPriority(inputFactors = {}, config = {}) {
        const {
            basePriority = 0.5,
            confidenceMultiplier = 0.3,
            goalBoost = 0.2,
            questionBoost = 0.1,
            maxPriority = 1.0
        } = config;
        
        const {
            truthValue = null,
            taskType = 'BELIEF',
            complexity = 1
        } = inputFactors;
        
        let priority = basePriority;
        
        if (truthValue) {
            const confidenceBoost = (truthValue.confidence ?? 0) * confidenceMultiplier;
            priority += confidenceBoost;
        }
        
        // Apply type-specific boosts
        if (taskType === 'GOAL') {
            priority += goalBoost;
        } else if (taskType === 'QUESTION') {
            priority += questionBoost;
        }
        
        // Apply complexity penalty if needed
        if (complexity > 1) {
            priority /= complexity;
        }
        
        return Math.min(maxPriority, priority);
    }
    
    /**
     * Calculate composite priority score for concepts
     * @param {Object} conceptFactors - Factors for concept priority
     * @param {Object} weights - Scoring weights
     * @returns {Object} Composite score with breakdown
     */
    static calculateCompositeScore(conceptFactors = {}, weights = {}) {
        const {
            activationWeight = 0.5,
            useCountWeight = 0.3,
            taskCountWeight = 0.2,
            qualityWeight = 0,
            complexityWeight = 0,
            recencyWeight = 0,
            diversityWeight = 0
        } = weights;
        
        const {
            activation = 0,
            useCount = 0,
            totalTasks = 0,
            quality = 0,
            complexity = 0,
            lastAccessed = Date.now(),
            diversityScore = 0,
            normalizationLimits = { useCount: 100, taskCount: 50 }
        } = conceptFactors;
        
        const normalizedUseCount = clamp(useCount / normalizationLimits.useCount, 0, 1);
        const normalizedTaskCount = clamp(totalTasks / normalizationLimits.taskCount, 0, 1);
        const recencyScore = this.calculateRecencyScore(lastAccessed);
        
        const compositeScore = 
            (activation * activationWeight) +
            (normalizedUseCount * useCountWeight) +
            (normalizedTaskCount * taskCountWeight) +
            (quality * qualityWeight) +
            (complexity * complexityWeight) +
            (recencyScore * recencyWeight) +
            (diversityScore * diversityWeight);
        
        return {
            compositeScore: clamp(compositeScore, 0, 1),
            activationScore: activation,
            useCountScore: normalizedUseCount,
            taskCountScore: normalizedTaskCount,
            qualityScore: quality,
            complexityScore: complexity,
            recencyScore: recencyScore,
            diversityScore: diversityScore
        };
    }
    
    /**
     * Calculate recency score based on time since last access
     * @param {number} lastAccessed - Timestamp of last access
     * @param {number} decayConstant - Decay constant (default: 24 hours in ms)
     * @returns {number} Recency score between 0 and 1
     */
    static calculateRecencyScore(lastAccessed, decayConstant = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const timeDiff = now - lastAccessed;
        // Recency score decreases with time (more recent = higher score)
        return Math.exp(-timeDiff / decayConstant);
    }
    
    /**
     * Normalize a priority score to a specific range
     * @param {number} score - Raw score to normalize
     * @param {number} min - Minimum value in range
     * @param {number} max - Maximum value in range
     * @returns {number} Normalized score
     */
    static normalize(score, min = 0, max = 1) {
        return clamp((score - min) / (max - min), 0, 1);
    }
    
    /**
     * Create a priority calculator with specific configuration
     * @param {Object} config - Configuration for the calculator
     * @returns {Function} Priority calculation function
     */
    static createCalculator(config = {}) {
        return (factors) => this.calculate(factors, config.weights, config.options);
    }
    
    /**
     * Calculates priority with validation
     * @param {Object} factors - Priority factors
     * @param {Object} weights - Weight configuration
     * @param {Object} options - Additional options
     * @returns {number} Calculated priority
     */
    static calculateWithValidation(factors = {}, weights = {}, options = {}) {
        // Validate inputs
        if (typeof factors !== 'object' || typeof weights !== 'object' || typeof options !== 'object') {
            throw new RuntimeError(
                'Priority calculation requires valid factor, weight, and option objects',
                'calculateWithValidation',
                { factors, weights, options }
            );
        }
        
        // Validate numerical values
        const numericFields = ['activation', 'confidence', 'complexity', 'recency', 'quality'];
        for (const field of numericFields) {
            if (factors[field] !== undefined && typeof factors[field] !== 'number') {
                throw new RuntimeError(
                    `Priority factor '${field}' must be a number`,
                    'calculateWithValidation',
                    { field, value: factors[field] }
                );
            }
        }
        
        return this.calculate(factors, weights, options);
    }
}

/**
 * Priority calculation strategies with validation
 */
export const PriorityStrategies = {
    /**
     * Standard priority calculation for tasks
     */
    standardTask: (task) => {
        if (!task?.budget) {return 0.5;}
        
        return PriorityCalculator.calculateWithValidation({
            activation: task.budget.priority || 0,
            confidence: task.truth?.c || 0,
            complexity: task.term?.complexity || 1,
            taskTypeFactor: task.type === 'GOAL' ? 1.2 : task.type === 'QUESTION' ? 1.1 : 1.0
        });
    },
    
    /**
     * Priority calculation for concepts
     */
    concept: (concept, weights = {}) => {
        if (!concept) {
            throw new RuntimeError(
                'Concept is required for priority calculation',
                'concept',
                { weights }
            );
        }
        
        return PriorityCalculator.calculateCompositeScore({
            activation: concept.activation || 0,
            useCount: concept.useCount || 0,
            totalTasks: concept.totalTasks || 0,
            quality: concept.quality || 0,
            complexity: concept.term?.complexity || 0,
            lastAccessed: concept.lastAccessed || Date.now()
        }, weights);
    },
    
    /**
     * Priority calculation for input tasks
     */
    input: (inputData, config = {}) => {
        if (!inputData) {
            throw new RuntimeError(
                'Input data is required for priority calculation',
                'input',
                { config }
            );
        }
        
        return PriorityCalculator.calculateInputPriority(inputData, config);
    },
    
    /**
     * Dynamic priority calculation based on context
     */
    dynamic: (entity, context = {}) => {
        if (!entity) {return 0;}
        
        // Determine entity type and apply appropriate strategy
        if (entity.budget) {
            // Likely a task
            return PriorityStrategies.standardTask(entity);
        } else if (entity.totalTasks !== undefined) {
            // Likely a concept
            return PriorityStrategies.concept(entity, context.weights);
        } else if (entity.truthValue) {
            // Likely input data
            return PriorityStrategies.input(entity, context.config);
        }
        
        // Default fallback
        return 0.5;
    }
};

/**
 * Priority scorer with configurable strategies
 */
export class PriorityScorer {
    constructor(config = {}) {
        this.strategies = { ...PriorityStrategies, ...config.customStrategies };
        this.weights = config.weights || {};
        this.defaults = config.defaults || {};
    }
    
    /**
     * Score an entity using the appropriate strategy
     * @param {Object} entity - Entity to score
     * @param {string} strategy - Strategy to use
     * @param {Object} options - Additional options
     * @returns {number|Object} Score or score object
     */
    score(entity, strategy = 'dynamic', options = {}) {
        const strategyFn = this.strategies[strategy];
        
        if (!strategyFn) {
            throw new RuntimeError(
                `Unknown priority scoring strategy: ${strategy}`,
                'score',
                { strategy, available: Object.keys(this.strategies) }
            );
        }
        
        try {
            return strategyFn(entity, { ...this.weights, ...options });
        } catch (error) {
            if (error instanceof RuntimeError) {
                throw error;
            }
            
            throw new RuntimeError(
                `Error in priority scoring: ${error.message}`,
                'score',
                { strategy, entity: entity?.constructor?.name, error: error.message }
            );
        }
    }
    
    /**
     * Batch score multiple entities
     * @param {Array} entities - Entities to score
     * @param {string} strategy - Strategy to use
     * @param {Object} options - Additional options
     * @returns {Array} Array of scored entities
     */
    batchScore(entities, strategy = 'dynamic', options = {}) {
        if (!Array.isArray(entities)) {
            throw new RuntimeError(
                'Entities must be an array',
                'batchScore',
                { entities, strategy }
            );
        }
        
        return entities.map(entity => ({
            entity,
            score: this.score(entity, strategy, options),
            timestamp: Date.now()
        }));
    }
    
    /**
     * Rank entities by priority score
     * @param {Array} entities - Entities to rank
     * @param {string} strategy - Strategy to use
     * @param {Object} options - Additional options
     * @returns {Array} Ranked entities with scores
     */
    rank(entities, strategy = 'dynamic', options = {}) {
        const scored = this.batchScore(entities, strategy, options);
        return scored.sort((a, b) => b.score - a.score);
    }
}