import {describe, it, expect, beforeEach} from '@jest/globals';
import {SelfAnalyzerService} from '../../../src/agent/services/SelfAnalyzerService.js';
import {MetacognitiveMonitor} from '../../../src/agent/services/MetacognitiveMonitor.js';
import type {NAR} from '../../../src/nar/nar.js';

function makeNAR(): NAR {
    return {
        listConcepts: () => [],
        getBeliefs: () => [],
        getLMClient: () => undefined,
    } as unknown as NAR;
}

describe('SelfAnalyzerService Policy — Phase 8 (I10)', () => {
    let analyzer: SelfAnalyzerService;

    beforeEach(() => {
        analyzer = new SelfAnalyzerService(makeNAR(), new MetacognitiveMonitor(null), null, {recencyEpisodes: 50});
    });

    it('starts with a stable baseline policy', () => {
        const p = analyzer.getPolicy();
        expect(p.routingWeights).toBeDefined();
        expect(p.toolSelectionBias).toEqual({});
        expect(p.promptBudget).toBeGreaterThan(0);
        expect(p.updatedAt).toBe(0);
    });

    it('recordRoute() captures recent route kinds', () => {
        analyzer.recordRoute('reason');
        analyzer.recordRoute('reason');
        analyzer.recordRoute('nl');
        const p = analyzer.recomputePolicy();
        expect(p.routingWeights['reason']).toBeGreaterThan(p.routingWeights['nl']!);
    });

    it('recomputePolicy() shifts weights toward the dominant pattern', () => {
        for (let i = 0; i < 18; i++) analyzer.recordRoute('reason');
        for (let i = 0; i < 2; i++) analyzer.recordRoute('nl');
        const p = analyzer.recomputePolicy();
        expect(p.routingWeights['reason']).toBeGreaterThan(0.8);
        expect(p.routingWeights['nl']).toBeLessThan(0.2);
    });

    it('recordTool() updates tool selection bias', () => {
        analyzer.recordTool('nar_believe');
        analyzer.recordTool('nar_believe');
        analyzer.recordTool('nar_query');
        const p = analyzer.recomputePolicy();
        expect(p.toolSelectionBias['nar_believe']).toBeGreaterThan(p.toolSelectionBias['nar_query']!);
    });

    it('rolling window is bounded by recencyEpisodes', () => {
        for (let i = 0; i < 200; i++) analyzer.recordRoute('reason');
        const p = analyzer.recomputePolicy();
        // recencyEpisodes=50; the rolling window caps at 50 entries
        expect(p.routingWeights['reason']).toBe(1);
        expect(p.recencyEpisodes).toBe(50);
    });

    it('updatedAt is set to a positive integer after recompute', () => {
        analyzer.recordRoute('reason');
        const p = analyzer.recomputePolicy();
        expect(p.updatedAt).toBeGreaterThan(0);
    });
});
