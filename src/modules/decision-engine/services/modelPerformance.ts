import { logger } from '../../../utils/logger.js';
import { Model } from '../../../types/index.js';
import { ModelPerformanceData, ModelsDatabase, COMPLEXITY_THRESHOLDS } from '../types/index.js';
import { modelsDbService } from './modelsDb.js';
import { openRouterModule } from '../../openrouter/index.js';

/**
 * Service for tracking and analyzing model performance
 */
export const modelPerformanceTracker = {
  /**
   * Track a model's performance for a specific task
   */
  async trackPerformance(
    model: Model,
    taskComplexity: number,
    response: { 
      success: boolean; 
      text?: string;
      timeTaken: number;
      tokenUsage: { prompt: number; completion: number; total: number; }
    }
  ): Promise<void> {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const modelId = model.id;

      // Calculate quality score if we have a response
      const qualityScore = response.text ? 
        openRouterModule.evaluateQuality(response.text, response.text) : 0;

      if (!modelsDb.models[modelId]) {
        // Initialize new model data
        modelsDb.models[modelId] = {
          id: modelId,
          name: model.name,
          provider: model.provider,
          lastSeen: new Date().toISOString(),
          contextWindow: model.contextWindow || 4096,
          successRate: response.success ? 1 : 0,
          qualityScore,
          avgResponseTime: response.timeTaken,
          complexityScore: taskComplexity,
          lastBenchmarked: new Date().toISOString(),
          benchmarkCount: 1,
          isFree: model.costPerToken.prompt === 0 && model.costPerToken.completion === 0
        };
      } else {
        // Update existing model data with weighted averages
        const benchmarkCount = modelsDb.models[modelId].benchmarkCount + 1;
        const weightedSuccessRate = (modelsDb.models[modelId].successRate * 
          modelsDb.models[modelId].benchmarkCount + (response.success ? 1 : 0)) / benchmarkCount;
        const weightedQualityScore = (modelsDb.models[modelId].qualityScore * 
          modelsDb.models[modelId].benchmarkCount + qualityScore) / benchmarkCount;
        const weightedResponseTime = (modelsDb.models[modelId].avgResponseTime * 
          modelsDb.models[modelId].benchmarkCount + response.timeTaken) / benchmarkCount;
        const weightedComplexityScore = (modelsDb.models[modelId].complexityScore * 
          modelsDb.models[modelId].benchmarkCount + taskComplexity) / benchmarkCount;

        modelsDb.models[modelId] = {
          ...modelsDb.models[modelId],
          lastSeen: new Date().toISOString(),
          successRate: weightedSuccessRate,
          qualityScore: weightedQualityScore,
          avgResponseTime: weightedResponseTime,
          complexityScore: weightedComplexityScore,
          lastBenchmarked: new Date().toISOString(),
          benchmarkCount
        };
      }

      // Save the updated database
      await modelsDbService.save();
      logger.debug(`Updated performance data for ${modelId}: Success=${response.success}, Quality=${qualityScore.toFixed(2)}, Time=${response.timeTaken}ms`);
    } catch (error) {
      logger.error('Error tracking model performance:', error);
    }
  },

  /**
   * Get performance statistics for a specific model
   */
  getModelStats(modelId: string): ModelPerformanceData | null {
    const modelsDb = modelsDbService.getDatabase();
    return modelsDb.models[modelId] || null;
  },

  /**
   * Get the best performing models for a specific complexity range
   */
  getBestPerformingModels(
    complexity: number,
    count: number = 3,
    options?: {
      prioritizeSpeed?: boolean;
      prioritizeQuality?: boolean;
      requireLocalOnly?: boolean;
    }
  ): Model[] {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const modelEntries = Object.entries(modelsDb.models);

      // Calculate scores based on weights
      const speedWeight = options?.prioritizeSpeed ? 0.4 : 0.2;
      const qualityWeight = options?.prioritizeQuality ? 0.4 : 0.3;
      const successWeight = 0.3;
      const complexityMatchWeight = 0.2;

      const scoredModels = modelEntries
        .filter(([_, data]) => {
          if (options?.requireLocalOnly) {
            return data.provider === 'local' || 
                   data.provider === 'lm-studio' || 
                   data.provider === 'ollama';
          }
          return true;
        })
        .map(([id, data]) => {
          // Calculate weighted score
          const speedScore = Math.max(0, 1 - (data.avgResponseTime / 15000));
          const complexityMatchScore = 1 - Math.abs(data.complexityScore - complexity);
          
          const score = (data.successRate * successWeight) +
                       (data.qualityScore * qualityWeight) +
                       (speedScore * speedWeight) +
                       (complexityMatchScore * complexityMatchWeight);

          return { id, score, data };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, count);

      return scoredModels.map(({ id }) => ({
        id,
        name: modelsDb.models[id].name,
        provider: modelsDb.models[id].provider,
        contextWindow: modelsDb.models[id].contextWindow,
        capabilities: {
          chat: true,
          completion: true
        },
        costPerToken: {
          prompt: 0,
          completion: 0
        }
      }));
    } catch (error) {
      logger.error('Error getting best performing models:', error);
      return [];
    }
  },

  /**
   * Get performance analysis for a specific complexity range
   */
  analyzePerformanceByComplexity(
    minComplexity: number,
    maxComplexity: number
  ): {
    averageSuccessRate: number;
    averageQualityScore: number;
    averageResponseTime: number;
    bestPerformingModels: string[];
  } {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const relevantModels = Object.values(modelsDb.models).filter(
        model => model.complexityScore >= minComplexity && 
                model.complexityScore <= maxComplexity
      );

      if (relevantModels.length === 0) {
        return {
          averageSuccessRate: 0,
          averageQualityScore: 0,
          averageResponseTime: 0,
          bestPerformingModels: []
        };
      }

      const totals = relevantModels.reduce((acc, model) => ({
        successRate: acc.successRate + model.successRate,
        qualityScore: acc.qualityScore + model.qualityScore,
        responseTime: acc.responseTime + model.avgResponseTime
      }), { successRate: 0, qualityScore: 0, responseTime: 0 });

      // Get top 3 models by overall performance
      const bestModels = relevantModels
        .sort((a, b) => {
          const scoreA = (a.successRate + a.qualityScore + (1 - a.avgResponseTime/15000)) / 3;
          const scoreB = (b.successRate + b.qualityScore + (1 - b.avgResponseTime/15000)) / 3;
          return scoreB - scoreA;
        })
        .slice(0, 3)
        .map(m => m.id);

      return {
        averageSuccessRate: totals.successRate / relevantModels.length,
        averageQualityScore: totals.qualityScore / relevantModels.length,
        averageResponseTime: totals.responseTime / relevantModels.length,
        bestPerformingModels: bestModels
      };
    } catch (error) {
      logger.error('Error analyzing performance by complexity:', error);
      return {
        averageSuccessRate: 0,
        averageQualityScore: 0,
        averageResponseTime: 0,
        bestPerformingModels: []
      };
    }
  }
};