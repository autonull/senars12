import type { LanguageModelV3 } from '@ai-sdk/provider';
import { type LanguageModel } from 'ai';
import { type LMSettings } from '../env-config';
/** Progress callback type for model download/initialization. */
export type ModelDownloadProgressCallback = (progress: number) => void;
export declare const localModel: (model: string, settings: LMSettings, onProgress?: ModelDownloadProgressCallback) => LanguageModel;
export declare const mockModel: () => LanguageModel;
export declare const setBuiltinProgressCallback: import("../provider-runtime").Delegated<"setBuiltinProgressCallback">;
export declare const getBuiltinProgressCallback: import("../provider-runtime").Delegated<"getBuiltinProgressCallback">;
export declare function createSeNARSRegistry(settings?: LMSettings): import("ai").Experimental_ExtractionProviderRegistry<{
    cloud: import("@ai-sdk/provider").ProviderV4 & {
        languageModel(modelId: "compact" | "fast" | "quality" | "structured"): import("@ai-sdk/provider").LanguageModelV4;
        embeddingModel(modelId: string): import("@ai-sdk/provider").EmbeddingModelV4;
        imageModel(modelId: string): import("@ai-sdk/provider").ImageModelV4;
        transcriptionModel(modelId: string): import("@ai-sdk/provider").TranscriptionModelV4;
        rerankingModel(modelId: string): import("@ai-sdk/provider").RerankingModelV4;
        speechModel(modelId: string): import("@ai-sdk/provider").SpeechModelV4;
        videoModel(modelId: string): import("@ai-sdk/provider").Experimental_VideoModelV4;
        decisionModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4;
        evaluationModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4 & {
            doEvaluate: import("@ai-sdk/provider").Experimental_DecisionModelV4['doDecide'];
        };
        extractionModel(modelId: string): import("@ai-sdk/provider").Experimental_ExtractionModelV4;
    } & {
        files?(): import("@ai-sdk/provider").FilesV4;
    } & {
        skills?(): import("@ai-sdk/provider").SkillsV4;
    };
    llamacpp: import("@ai-sdk/provider").ProviderV4 & {
        languageModel(modelId: "compact" | "fast" | "quality" | "structured"): import("@ai-sdk/provider").LanguageModelV4;
        embeddingModel(modelId: string): import("@ai-sdk/provider").EmbeddingModelV4;
        imageModel(modelId: string): import("@ai-sdk/provider").ImageModelV4;
        transcriptionModel(modelId: string): import("@ai-sdk/provider").TranscriptionModelV4;
        rerankingModel(modelId: string): import("@ai-sdk/provider").RerankingModelV4;
        speechModel(modelId: string): import("@ai-sdk/provider").SpeechModelV4;
        videoModel(modelId: string): import("@ai-sdk/provider").Experimental_VideoModelV4;
        decisionModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4;
        evaluationModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4 & {
            doEvaluate: import("@ai-sdk/provider").Experimental_DecisionModelV4['doDecide'];
        };
        extractionModel(modelId: string): import("@ai-sdk/provider").Experimental_ExtractionModelV4;
    } & {
        files?(): import("@ai-sdk/provider").FilesV4;
    } & {
        skills?(): import("@ai-sdk/provider").SkillsV4;
    };
    'llamacpp-embedded': import("@ai-sdk/provider").ProviderV4 & {
        languageModel(modelId: "compact" | "fast" | "quality" | "structured"): import("@ai-sdk/provider").LanguageModelV4;
        embeddingModel(modelId: string): import("@ai-sdk/provider").EmbeddingModelV4;
        imageModel(modelId: string): import("@ai-sdk/provider").ImageModelV4;
        transcriptionModel(modelId: string): import("@ai-sdk/provider").TranscriptionModelV4;
        rerankingModel(modelId: string): import("@ai-sdk/provider").RerankingModelV4;
        speechModel(modelId: string): import("@ai-sdk/provider").SpeechModelV4;
        videoModel(modelId: string): import("@ai-sdk/provider").Experimental_VideoModelV4;
        decisionModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4;
        evaluationModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4 & {
            doEvaluate: import("@ai-sdk/provider").Experimental_DecisionModelV4['doDecide'];
        };
        extractionModel(modelId: string): import("@ai-sdk/provider").Experimental_ExtractionModelV4;
    } & {
        files?(): import("@ai-sdk/provider").FilesV4;
    } & {
        skills?(): import("@ai-sdk/provider").SkillsV4;
    };
    webllm: import("@ai-sdk/provider").ProviderV4 & {
        languageModel(modelId: "compact" | "fast" | "quality" | "structured"): import("@ai-sdk/provider").LanguageModelV4;
        embeddingModel(modelId: string): import("@ai-sdk/provider").EmbeddingModelV4;
        imageModel(modelId: string): import("@ai-sdk/provider").ImageModelV4;
        transcriptionModel(modelId: string): import("@ai-sdk/provider").TranscriptionModelV4;
        rerankingModel(modelId: string): import("@ai-sdk/provider").RerankingModelV4;
        speechModel(modelId: string): import("@ai-sdk/provider").SpeechModelV4;
        videoModel(modelId: string): import("@ai-sdk/provider").Experimental_VideoModelV4;
        decisionModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4;
        evaluationModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4 & {
            doEvaluate: import("@ai-sdk/provider").Experimental_DecisionModelV4['doDecide'];
        };
        extractionModel(modelId: string): import("@ai-sdk/provider").Experimental_ExtractionModelV4;
    } & {
        files?(): import("@ai-sdk/provider").FilesV4;
    } & {
        skills?(): import("@ai-sdk/provider").SkillsV4;
    };
    builtin: import("@ai-sdk/provider").ProviderV4 & {
        languageModel(modelId: "compact" | "fast" | "mock" | "quality" | "structured"): import("@ai-sdk/provider").LanguageModelV4;
        embeddingModel(modelId: string): import("@ai-sdk/provider").EmbeddingModelV4;
        imageModel(modelId: string): import("@ai-sdk/provider").ImageModelV4;
        transcriptionModel(modelId: string): import("@ai-sdk/provider").TranscriptionModelV4;
        rerankingModel(modelId: string): import("@ai-sdk/provider").RerankingModelV4;
        speechModel(modelId: string): import("@ai-sdk/provider").SpeechModelV4;
        videoModel(modelId: string): import("@ai-sdk/provider").Experimental_VideoModelV4;
        decisionModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4;
        evaluationModel(modelId: string): import("@ai-sdk/provider").Experimental_DecisionModelV4 & {
            doEvaluate: import("@ai-sdk/provider").Experimental_DecisionModelV4['doDecide'];
        };
        extractionModel(modelId: string): import("@ai-sdk/provider").Experimental_ExtractionModelV4;
    } & {
        files?(): import("@ai-sdk/provider").FilesV4;
    } & {
        skills?(): import("@ai-sdk/provider").SkillsV4;
    };
}, ":">;
export type SeNARSRegistry = ReturnType<typeof createSeNARSRegistry>;
export type SeNARSModelId = Parameters<SeNARSRegistry['languageModel']>[0];
export declare function createMockLanguageModel(generateTextFn?: (prompt: string) => string | Promise<string>): LanguageModelV3;
//# sourceMappingURL=model-factory.d.ts.map