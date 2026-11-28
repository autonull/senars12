export interface TourStep {
    markId: string;
    label: string;
    timestamp: number;
    narrative: string;
    evidence: string[];
    frameHash?: string;
}
export interface GeneratedTour {
    runId: string;
    programName: string;
    generatedAt: string;
    steps: TourStep[];
    summary: string;
}
export declare function generateTour(runId: string): Promise<GeneratedTour>;
export declare function saveTour(tour: GeneratedTour, outputPath?: string): Promise<string>;
export declare function renderTourMarkdown(tour: GeneratedTour): Promise<string>;
//# sourceMappingURL=tour.d.ts.map