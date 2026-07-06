/**
 * @file src/tools/ExplanationService.js
 * @description LM-based explanation service for tool execution results
 */

import {BaseComponent} from '../util/BaseComponent.js';

/**
 * Service that uses Language Models to explain tool execution results
 */
export class ExplanationService extends BaseComponent {
    /**
     * @param {object} config - Configuration for the explanation service
     * @param {object} config.lm - Language Model instance
     * @param {number} config.defaultTemperature - Default temperature for LM responses
     * @param {number} config.maxTokens - Maximum tokens for explanations
     */
    constructor(config = {}) {
        super(config, 'ExplanationService');
        this.lm = this.config.lm;
        this.defaultTemperature = this.config.defaultTemperature || 0.3; // Low temperature for factual explanations
        this.maxTokens = this.config.maxTokens || 500;

        if (!this.lm) {
            this.logWarn('Explanation service initialized without LM - explanations will be simulated');
        }
    }

    async _initialize() {
        // Initialization handled by base class lifecycle logging
    }

    /**
     * Generate an explanation for a single tool execution result
     * @param {object} toolResult - The tool execution result to explain
     * @param {object} context - Additional context for the explanation
     * @returns {Promise<string>} - Generated explanation
     */
    async explainToolResult(toolResult, context = {}) {
        if (!toolResult) {
            throw new Error('Tool result is required for explanation');
        }

        const {success, toolId, result, error, executionTime, command, url, operation} = toolResult;

        // If LM is not available, return a simple explanation
        if (!this.lm) {
            return this._generateSimpleExplanation(toolResult, context);
        }

        // Create a detailed prompt for the LM explaining the tool result
        const prompt = this._createExplanationPrompt(toolResult, context);

        try {
            const explanation = await this.lm.generateText(prompt, {
                temperature: this.defaultTemperature,
                maxTokens: this.maxTokens
            });

            this.logger.info('Generated explanation for tool result', {
                toolId: toolResult.toolId,
                success: toolResult.success
            });

            return explanation;
        } catch (error) {
            this.logger.error('Failed to generate LM explanation:', error);

            // Fallback to simple explanation if LM fails
            return this._generateSimpleExplanation(toolResult, context);
        }
    }

    /**
     * Generate explanations for multiple tool results
     * @param {Array<object>} toolResults - Array of tool results to explain
     * @param {object} context - Additional context for the explanations
     * @returns {Promise<Array<string>>} - Array of explanations
     */
    async explainToolResults(toolResults, context = {}) {
        if (!Array.isArray(toolResults)) {
            throw new Error('Tool results must be an array');
        }

        const explanations = [];

        for (const result of toolResults) {
            const explanation = await this.explainToolResult(result, context);
            explanations.push(explanation);
        }

        return explanations;
    }

    /**
     * Explain the relationship between multiple tool results
     * @param {Array<object>} toolResults - Array of tool results
     * @param {object} context - Context for the comparative explanation
     * @returns {Promise<string>} - Comparative explanation
     */
    async explainToolRelationships(toolResults, context = {}) {
        if (!Array.isArray(toolResults) || toolResults.length <= 1) {
            throw new Error('Need at least 2 tool results for relationship explanation');
        }

        if (!this.lm) {
            return 'Relationship explanation requires Language Model to be available.';
        }

        const prompt = this._createRelationshipPrompt(toolResults, context);

        try {
            const explanation = await this.lm.generateText(prompt, {
                temperature: this.defaultTemperature,
                maxTokens: this.maxTokens
            });

            return explanation;
        } catch (error) {
            this.logger.error('Failed to generate relationship explanation:', error);
            return `Could not generate relationship explanation: ${error.message}`;
        }
    }

    /**
     * Create a prompt for explaining a single tool result
     * @private
     */
    _createExplanationPrompt(toolResult, context) {
        const {
            success, toolId, result, error, executionTime, command, url,
            operation, stdout, stderr, content, metadata
        } = toolResult;

        let resultDetails = '';

        if (success) {
            if (stdout !== undefined) {
                resultDetails = `Command output: "${stdout?.substring(0, 500) || 'No output'}"`;
            } else if (content !== undefined) {
                resultDetails = `Content extracted: "${content?.substring(0, 500) || 'No content'}"`;
            } else if (result) {
                resultDetails = `Result: ${JSON.stringify(result).substring(0, 500)}`;
            } else if (metadata) {
                resultDetails = `Metadata: ${JSON.stringify(metadata)}`;
            }
        } else {
            resultDetails = `Error: ${error || 'Unknown error'}`;
        }

        return `Explain the following tool execution result in simple terms:

Tool: ${toolId}
Operation: ${operation || 'unknown'}
Success: ${success ? 'Yes' : 'No'}
Execution Time: ${executionTime}ms

${command ? `Command: ${command}\n` : ''}
${url ? `URL: ${url}\n` : ''}
${resultDetails}

${context.request ? `User request: ${context.request}\n` : ''}
${context.purpose ? `Purpose: ${context.purpose}\n` : ''}

Provide a clear, concise explanation of what happened and what the results mean.`;
    }

    /**
     * Create a prompt for explaining relationships between multiple tool results
     * @private
     */
    _createRelationshipPrompt(toolResults, context) {
        const resultsSummary = toolResults.map((result, index) =>
            `${index + 1}. Tool: ${result.toolId}, Success: ${result.success}, Operation: ${result.operation || 'unknown'}`
        ).join('\n');

        return `Analyze the relationships and connections between these ${toolResults.length} tool executions:

${resultsSummary}

${context.request ? `Original request: ${context.request}\n` : ''}
${context.purpose ? `Overall purpose: ${context.purpose}\n` : ''}

Explain how these results work together to fulfill the request or achieve the purpose.`;
    }

    /**
     * Generate a simple explanation without LM
     * @private
     */
    _generateSimpleExplanation(toolResult, context) {
        const {success, toolId, error, executionTime, operation} = toolResult;

        if (success) {
            return `Tool "${toolId}" (${operation || 'operation'}) executed successfully in ${executionTime}ms.`;
        } else {
            return `Tool "${toolId}" (${operation || 'operation'}) failed: ${error || 'Unknown error'}.`;
        }
    }

    /**
     * Summarize multiple tool results
     * @param {Array<object>} toolResults - Array of tool results to summarize
     * @param {object} context - Context for the summary
     * @returns {Promise<string>} - Summary of the results
     */
    async summarizeToolExecution(toolResults, context = {}) {
        if (!Array.isArray(toolResults)) {
            throw new Error('Tool results must be an array for summarization');
        }

        // If LM is not available, create a simple summary
        if (!this.lm) {
            const successCount = toolResults.filter(r => r.success).length;
            return `Executed ${toolResults.length} tools, ${successCount} succeeded, ${toolResults.length - successCount} failed.`;
        }

        const prompt = this._createSummaryPrompt(toolResults, context);

        try {
            const summary = await this.lm.generateText(prompt, {
                temperature: this.defaultTemperature,
                maxTokens: this.maxTokens
            });

            return summary;
        } catch (error) {
            this.logger.error('Failed to generate execution summary:', error);
            const successCount = toolResults.filter(r => r.success).length;
            return `Could not generate detailed summary. Executed ${toolResults.length} tools, ${successCount} succeeded, ${toolResults.length - successCount} failed.`;
        }
    }

    /**
     * Create a prompt for summarizing tool execution
     * @private
     */
    _createSummaryPrompt(toolResults, context) {
        const summaryInfo = toolResults.map((result, index) =>
            `${index + 1}. ${result.toolId}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.executionTime}ms)`
        ).join('\n');

        return `Create a concise summary of the following tool execution results:

${summaryInfo}

${context.request ? `Request: ${context.request}\n` : ''}
${context.purpose ? `Purpose: ${context.purpose}\n` : ''}

Summary should cover overall success/failure, key outcomes, and any important findings.`;
    }

    /**
     * Assess the quality and relevance of tool results
     * @param {Array<object>} toolResults - Array of tool results to assess
     * @param {object} context - Context for the assessment
     * @returns {Promise<object>} - Assessment results
     */
    async assessToolResults(toolResults, context = {}) {
        if (!Array.isArray(toolResults)) {
            throw new Error('Tool results must be an array for assessment');
        }

        if (!this.lm) {
            // Simple assessment without LM
            return {
                quality: 'medium', // Default when LM is not available
                completeness: toolResults.every(r => r.success) ? 'complete' : 'partial',
                relevance: context.purpose ? 'medium' : 'unknown',
                overallScore: 0.5,
                feedback: 'Assessment requires Language Model for detailed analysis'
            };
        }

        const prompt = this._createAssessmentPrompt(toolResults, context);

        try {
            const assessment = await this.lm.generateText(prompt, {
                temperature: this.defaultTemperature,
                maxTokens: this.maxTokens
            });

            // Parse or structure the assessment result
            return {
                quality: this._extractQuality(assessment),
                completeness: this._extractCompleteness(assessment),
                relevance: this._extractRelevance(assessment),
                overallScore: this._extractScore(assessment),
                feedback: assessment
            };
        } catch (error) {
            this.logger.error('Failed to generate assessment:', error);
            return {
                quality: 'unknown',
                completeness: 'unknown',
                relevance: 'unknown',
                overallScore: 0,
                feedback: `Could not assess results: ${error.message}`
            };
        }
    }

    /**
     * Extract quality from assessment text
     * @private
     */
    _extractQuality(assessment) {
        // Simple keyword-based extraction (in a real implementation, you'd use more sophisticated parsing)
        if (assessment.toLowerCase().includes('high quality') || assessment.toLowerCase().includes('excellent')) {
            return 'high';
        } else if (assessment.toLowerCase().includes('low quality') || assessment.toLowerCase().includes('poor')) {
            return 'low';
        }
        return 'medium';
    }

    /**
     * Extract completeness from assessment text
     * @private
     */
    _extractCompleteness(assessment) {
        if (assessment.toLowerCase().includes('complete') || assessment.toLowerCase().includes('full')) {
            return 'complete';
        } else if (assessment.toLowerCase().includes('partial') || assessment.toLowerCase().includes('incomplete')) {
            return 'partial';
        }
        return 'unknown';
    }

    /**
     * Extract relevance from assessment text
     * @private
     */
    _extractRelevance(assessment) {
        if (assessment.toLowerCase().includes('highly relevant') || assessment.toLowerCase().includes('very relevant')) {
            return 'high';
        } else if (assessment.toLowerCase().includes('not relevant') || assessment.toLowerCase().includes('irrelevant')) {
            return 'low';
        }
        return 'medium';
    }

    /**
     * Extract score from assessment text
     * @private
     */
    _extractScore(assessment) {
        // Look for scores in format like "score: X/X" or "rating: X out of Y"
        const scoreRegex = /(?:score|rating):\s*(\d+(?:\.\d+)?)\s*(?:\/|out of|over)?\s*(\d+(?:\.\d+)?)/i;
        const match = assessment.match(scoreRegex);

        if (match) {
            const numerator = parseFloat(match[1]);
            const denominator = parseFloat(match[2]) || 10; // Assume 10 if not specified
            return numerator / denominator;
        }

        // Default to 0.5 if no score found
        return 0.5;
    }
}