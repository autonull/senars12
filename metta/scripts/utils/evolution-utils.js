#!/usr/bin/env node

import * as dfd from 'danfojs';
import {writeFile} from 'fs/promises';

/**
 * Genetic algorithm and evolution utilities
 */
export const EvolutionUtils = {
    /**
     * Create a random configuration based on parameter ranges
     */
    generateRandomConfig: (parameterRanges) => {
        const config = {};

        for (const category in parameterRanges) {
            config[category] = {};
            for (const param in parameterRanges[category]) {
                const range = parameterRanges[category][param];
                config[category][param] = Math.random() * (range.max - range.min) + range.min;
            }
        }

        return config;
    },

    /**
     * Tournament selection for genetic algorithms
     */
    selectParents: (population, tournamentSize = 3) => {
        const selected = [];

        for (let i = 0; i < 2; i++) {
            const tournament = [];
            for (let j = 0; j < tournamentSize; j++) {
                const randomIdx = Math.floor(Math.random() * population.length);
                tournament.push(population[randomIdx]);
            }

            // Select the best in tournament
            tournament.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
            selected.push(tournament[0]);
        }

        return selected;
    },

    /**
     * Simple crossover - average parameter values
     */
    crossover: (parent1, parent2) => {
        // Deep copy parent1's config
        const child = JSON.parse(JSON.stringify(parent1.config));

        for (const category in child) {
            for (const param in child[category]) {
                // Mix values from both parents
                const val1 = parent1.config[category][param];
                const val2 = parent2.config[category][param];
                child[category][param] = (val1 + val2) / 2;
            }
        }

        return child;
    },

    /**
     * Apply random mutations to parameters
     */
    mutate: (config, parameterRanges, mutationRate = 0.1) => {
        const mutatedConfig = {...config};

        for (const category in parameterRanges) {
            if (!mutatedConfig[category]) mutatedConfig[category] = {...config[category]};

            for (const param in parameterRanges[category]) {
                if (Math.random() < mutationRate) {
                    const range = parameterRanges[category][param];
                    mutatedConfig[category][param] = Math.random() * (range.max - range.min) + range.min;
                }
            }
        }

        return mutatedConfig;
    },

    /**
     * Create next generation using selection, crossover, and mutation
     */
    createNextGeneration: async (population, parameterRanges, options = {}) => {
        const {
            populationSize = 5,
            mutationRate = 0.1,
            elitismCount = 1
        } = options;

        // Sort population by fitness (descending)
        const sortedPop = [...population].sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

        // Keep best individuals (elitism)
        const nextPopulation = sortedPop.slice(0, elitismCount);

        // Fill the rest through selection, crossover and mutation
        while (nextPopulation.length < populationSize) {
            const [parent1, parent2] = EvolutionUtils.selectParents(population);
            let childConfig = EvolutionUtils.crossover(parent1, parent2);
            childConfig = EvolutionUtils.mutate(childConfig, parameterRanges, mutationRate);

            nextPopulation.push({
                config: childConfig,
                id: nextPopulation.length
            });
        }

        return nextPopulation;
    },

    /**
     * Calculate fitness statistics for a population
     */
    calculatePopulationStats: (population) => {
        if (population.length === 0) return {best: 0, average: 0, worst: 0, std: 0, median: 0};

        const fitnesses = population.map(ind => ind.fitness || 0);

        // Use danfojs for more comprehensive statistical analysis
        const fitnessSeries = new dfd.Series(fitnesses);

        return {
            best: fitnessSeries.max(),
            average: fitnessSeries.mean(),
            worst: fitnessSeries.min(),
            std: fitnessSeries.std(),
            median: fitnessSeries.median(),
            variance: fitnessSeries.var(),
            count: fitnesses.length
        };
    },

    /**
     * Save configuration to file
     */
    saveConfig: async (config, filePath) => {
        await writeFile(filePath, JSON.stringify(config, null, 2));
    }
};

export default EvolutionUtils;