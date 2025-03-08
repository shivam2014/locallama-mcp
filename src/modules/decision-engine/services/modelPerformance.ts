import { logger } from '../../../utils/logger.js';
import { Model } from '../../../types/index.js';
import { ModelPerformanceData, ModelsDatabase, COMPLEXITY_THRESHOLDS } from '../types/index.js';
import { modelsDbService } from './modelsDb.js';
import { openRouterModule } from '../../openrouter/index.js';

/**
 * Enhanced service for tracking and analyzing model performance with resource monitoring
 */
export const modelPerformanceTracker = {
  /**
   * Track a model's performance for a specific task with expanded metrics
   */
  async trackPerformance(
    model: Model,
    taskComplexity: number,
    response: { 
      success: boolean; 
      text?: string;
      timeTaken: number;
      tokenUsage: { prompt: number; completion: number; total: number; }
      systemResources?: {
        cpuUsage?: number; // Percentage of CPU used (0-100)
        memoryUsage?: number; // Memory usage in MB
        gpuMemoryUsage?: number; // GPU memory usage in MB, if applicable
        duration?: number; // Total processing time in ms
      }
    }
  ): Promise<void> {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const modelId = model.id;

      // Calculate quality score if we have a response
      const qualityScore = response.text ? 
        openRouterModule.evaluateQuality(response.text, response.text) : 0;

      // Calculate token efficiency (output quality per token)
      const tokenEfficiency = response.tokenUsage.total > 0 ? 
        qualityScore / Math.log2(response.tokenUsage.total + 1) : 0;
        
      // Calculate system resource efficiency score (normalized 0-1)
      let systemResourceUsage = 0;
      if (response.systemResources) {
        // Normalize and combine resource metrics (lower is better)
        const cpuScore = response.systemResources.cpuUsage ? 
          response.systemResources.cpuUsage / 100 : 0;
          
        const memScore = response.systemResources.memoryUsage ? 
          Math.min(1, response.systemResources.memoryUsage / 8192) : 0; // Normalize to 8GB max
          
        const gpuScore = response.systemResources.gpuMemoryUsage ? 
          Math.min(1, response.systemResources.gpuMemoryUsage / 8192) : 0;
          
        // Calculate combined resource score (weighted average)
        systemResourceUsage = (cpuScore * 0.3) + (memScore * 0.4) + (gpuScore * 0.3);
      }
      
      // Calculate memory footprint (in GB) if available
      const memoryFootprint = response.systemResources?.memoryUsage ? 
        response.systemResources.memoryUsage / 1024 : undefined;

      if (!modelsDb.models[modelId]) {
        // Initialize new model data with expanded metrics
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
          isFree: model.costPerToken.prompt === 0 && model.costPerToken.completion === 0,
          // New metrics
          tokenEfficiency,
          systemResourceUsage,
          memoryFootprint,
          // Resource usage history
          resourceHistory: [{
            timestamp: new Date().toISOString(),
            tokenUsage: response.tokenUsage.total,
            responseTime: response.timeTaken,
            success: response.success
          }]
        };
      } else {
        // Update existing model data with weighted averages for all metrics
        const benchmarkCount = modelsDb.models[modelId].benchmarkCount + 1;
        const weightedSuccessRate = (modelsDb.models[modelId].successRate * 
          modelsDb.models[modelId].benchmarkCount + (response.success ? 1 : 0)) / benchmarkCount;
        const weightedQualityScore = (modelsDb.models[modelId].qualityScore * 
          modelsDb.models[modelId].benchmarkCount + qualityScore) / benchmarkCount;
        const weightedResponseTime = (modelsDb.models[modelId].avgResponseTime * 
          modelsDb.models[modelId].benchmarkCount + response.timeTaken) / benchmarkCount;
        const weightedComplexityScore = (modelsDb.models[modelId].complexityScore * 
          modelsDb.models[modelId].benchmarkCount + taskComplexity) / benchmarkCount;
          
        // Calculate weighted token efficiency and system resource usage
        const weightedTokenEfficiency = (modelsDb.models[modelId].tokenEfficiency || 0) * 
          modelsDb.models[modelId].benchmarkCount + tokenEfficiency / benchmarkCount;
          
        const weightedSystemResourceUsage = (modelsDb.models[modelId].systemResourceUsage || 0) *
          modelsDb.models[modelId].benchmarkCount + systemResourceUsage / benchmarkCount;
          
        const weightedMemoryFootprint = memoryFootprint !== undefined && 
          modelsDb.models[modelId].memoryFootprint !== undefined ?
          (modelsDb.models[modelId].memoryFootprint * 
            modelsDb.models[modelId].benchmarkCount + memoryFootprint) / benchmarkCount :
          memoryFootprint || modelsDb.models[modelId].memoryFootprint;

        // Update the model data
        modelsDb.models[modelId] = {
          ...modelsDb.models[modelId],
          lastSeen: new Date().toISOString(),
          successRate: weightedSuccessRate,
          qualityScore: weightedQualityScore,
          avgResponseTime: weightedResponseTime,
          complexityScore: weightedComplexityScore,
          lastBenchmarked: new Date().toISOString(),
          benchmarkCount,
          tokenEfficiency: weightedTokenEfficiency,
          systemResourceUsage: weightedSystemResourceUsage,
          memoryFootprint: weightedMemoryFootprint,
        };

        // Add to resource usage history (keep last 10 entries)
        const history = modelsDb.models[modelId].resourceHistory || [];
        history.push({
          timestamp: new Date().toISOString(),
          tokenUsage: response.tokenUsage.total,
          responseTime: response.timeTaken,
          success: response.success
        });
        modelsDb.models[modelId].resourceHistory = history.slice(-10); // Keep only the last 10 entries
      }

      // Save the updated database
      await modelsDbService.save();
      logger.debug(`Updated performance data for ${modelId}: Success=${response.success}, Quality=${qualityScore.toFixed(2)}, Time=${response.timeTaken}ms, TokenEff=${tokenEfficiency.toFixed(3)}`);
    } catch (error) {
      logger.error('Error tracking model performance:', error);
    }
  },

  /**
   * Track system resource usage for a model
   */
  async trackResourceUsage(
    modelId: string, 
    resources: {
      cpuUsage?: number;
      memoryUsage?: number;
      gpuMemoryUsage?: number;
      responseTime?: number;
    }
  ): Promise<void> {
    try {
      const modelsDb = modelsDbService.getDatabase();
      
      if (!modelsDb.models[modelId]) {
        logger.warn(`Cannot track resources for unknown model: ${modelId}`);
        return;
      }
      
      // Calculate system resource usage score (normalized 0-1)
      let systemResourceUsage = 0;
      const cpuScore = resources.cpuUsage ? resources.cpuUsage / 100 : 0;
      const memScore = resources.memoryUsage ? 
        Math.min(1, resources.memoryUsage / 8192) : 0;
      const gpuScore = resources.gpuMemoryUsage ? 
        Math.min(1, resources.gpuMemoryUsage / 8192) : 0;
      
      systemResourceUsage = (cpuScore * 0.3) + (memScore * 0.4) + (gpuScore * 0.3);
      
      // Update with weighted average
      const benchmarkCount = modelsDb.models[modelId].benchmarkCount || 1;
      const currentResourceScore = modelsDb.models[modelId].systemResourceUsage || 0;
      const weightedResourceScore = 
        (currentResourceScore * (benchmarkCount - 1) + systemResourceUsage) / benchmarkCount;
        
      // Update memory footprint if available
      if (resources.memoryUsage) {
        const memoryFootprint = resources.memoryUsage / 1024; // Convert to GB
        modelsDb.models[modelId].memoryFootprint = 
          modelsDb.models[modelId].memoryFootprint !== undefined ?
          (modelsDb.models[modelId].memoryFootprint + memoryFootprint) / 2 :
          memoryFootprint;
      }
      
      // Update system resource usage
      modelsDb.models[modelId].systemResourceUsage = weightedResourceScore;
      
      // Save the updated database
      await modelsDbService.save();
      logger.debug(`Updated resource data for ${modelId}: System resource score=${weightedResourceScore.toFixed(3)}`);
    } catch (error) {
      logger.error('Error tracking model resource usage:', error);
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
      maximizeResourceEfficiency?: boolean;
    }
  ): Model[] {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const modelEntries = Object.entries(modelsDb.models);
      
      // Calculate scores based on weights
      const speedWeight = options?.prioritizeSpeed ? 0.4 : 0.2;
      const qualityWeight = options?.prioritizeQuality ? 0.4 : 0.25;
      const successWeight = 0.3;
      const complexityMatchWeight = 0.2;
      const resourceWeight = options?.maximizeResourceEfficiency ? 0.4 : 0.2;
      const tokenEfficiencyWeight = 0.15;
      
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
          // Calculate weighted score with enhanced metrics
          const speedScore = Math.max(0, 1 - (data.avgResponseTime / 15000));
          const complexityMatchScore = 1 - Math.abs(data.complexityScore - complexity);
          
          // Resource efficiency scores (invert for scoring - lower usage is better)
          const resourceScore = data.systemResourceUsage !== undefined ? 
            1 - data.systemResourceUsage : 0.5; // Default to middle if unknown
            
          const tokenEfficiencyScore = data.tokenEfficiency || 0.5;
          
          // Calculate weighted total score
          const score = (data.successRate * successWeight) +
                       (data.qualityScore * qualityWeight) +
                       (speedScore * speedWeight) +
                       (complexityMatchScore * complexityMatchWeight) +
                       (resourceScore * resourceWeight) +
                       (tokenEfficiencyScore * tokenEfficiencyWeight);
                       
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
    averageTokenEfficiency: number;
    averageResourceUsage: number;
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
          averageTokenEfficiency: 0,
          averageResourceUsage: 0,
          bestPerformingModels: []
        };
      }
      
      // Extended metrics totals
      const totals = relevantModels.reduce((acc, model) => ({
        successRate: acc.successRate + model.successRate,
        qualityScore: acc.qualityScore + model.qualityScore,
        responseTime: acc.responseTime + model.avgResponseTime,
        tokenEfficiency: acc.tokenEfficiency + (model.tokenEfficiency || 0),
        resourceUsage: acc.resourceUsage + (model.systemResourceUsage || 0)
      }), { 
        successRate: 0, 
        qualityScore: 0, 
        responseTime: 0,
        tokenEfficiency: 0,
        resourceUsage: 0 
      });

      // Get top 3 models by overall performance with enhanced scoring
      const bestModels = relevantModels
        .sort((a, b) => {
          const scoreA = (
            a.successRate * 0.3 + 
            a.qualityScore * 0.25 + 
            (1 - a.avgResponseTime/15000) * 0.2 +
            (a.tokenEfficiency || 0) * 0.15 +
            (1 - (a.systemResourceUsage || 0.5)) * 0.1
          );
          
          const scoreB = (
            b.successRate * 0.3 + 
            b.qualityScore * 0.25 + 
            (1 - b.avgResponseTime/15000) * 0.2 +
            (b.tokenEfficiency || 0) * 0.15 +
            (1 - (b.systemResourceUsage || 0.5)) * 0.1
          );
          
          return scoreB - scoreA;
        })
        .slice(0, 3)
        .map(m => m.id);

      return {
        averageSuccessRate: totals.successRate / relevantModels.length,
        averageQualityScore: totals.qualityScore / relevantModels.length,
        averageResponseTime: totals.responseTime / relevantModels.length,
        averageTokenEfficiency: totals.tokenEfficiency / relevantModels.length,
        averageResourceUsage: totals.resourceUsage / relevantModels.length,
        bestPerformingModels: bestModels
      };
    } catch (error) {
      logger.error('Error analyzing performance by complexity:', error);
      return {
        averageSuccessRate: 0,
        averageQualityScore: 0,
        averageResponseTime: 0,
        averageTokenEfficiency: 0,
        averageResourceUsage: 0,
        bestPerformingModels: []
      };
    }
  },

  /**
   * Get resource usage history for a specific model
   */
  getResourceHistory(modelId: string): {
    timestamp: string;
    tokenUsage: number;
    responseTime: number;
    success: boolean;
  }[] {
    try {
      const modelsDb = modelsDbService.getDatabase();
      return modelsDb.models[modelId]?.resourceHistory || [];
    } catch (error) {
      logger.error('Error getting resource history:', error);
      return [];
    }
  },
  
  /**
   * Get resource efficiency report across all models
   */
  getResourceEfficiencyReport(): {
    mostEfficientModels: {id: string, provider: string, efficiency: number}[];
    leastEfficientModels: {id: string, provider: string, efficiency: number}[];
    averageLocalModelEfficiency: number;
    averageRemoteModelEfficiency: number;
  } {
    try {
      const modelsDb = modelsDbService.getDatabase();
      const modelEntries = Object.entries(modelsDb.models);
      
      if (modelEntries.length === 0) {
        return {
          mostEfficientModels: [],
          leastEfficientModels: [],
          averageLocalModelEfficiency: 0,
          averageRemoteModelEfficiency: 0
        };
      }
      
      // Calculate efficiency score for each model
      const scoredModels = modelEntries
        .filter(([_, data]) => data.systemResourceUsage !== undefined && data.tokenEfficiency !== undefined)
        .map(([id, data]) => {
          // Calculate efficiency score (higher is better)
          const resourceScore = 1 - (data.systemResourceUsage || 0.5); 
          const tokenScore = data.tokenEfficiency || 0;
          const efficiency = (resourceScore * 0.6) + (tokenScore * 0.4);
          
          return {
            id,
            provider: data.provider,
            efficiency
          };
        })
        .sort((a, b) => b.efficiency - a.efficiency);
      
      // Get most and least efficient models
      const mostEfficientModels = scoredModels.slice(0, 3);
      const leastEfficientModels = [...scoredModels].reverse().slice(0, 3);
      
      // Calculate averages by provider type
      const localModels = scoredModels.filter(m => 
        m.provider === 'local' || 
        m.provider === 'lm-studio' || 
        m.provider === 'ollama'
      );
      
      const remoteModels = scoredModels.filter(m => 
        m.provider !== 'local' && 
        m.provider !== 'lm-studio' && 
        m.provider !== 'ollama'
      );
      
      const averageLocalModelEfficiency = localModels.length > 0 ?
        localModels.reduce((sum, m) => sum + m.efficiency, 0) / localModels.length : 0;
        
      const averageRemoteModelEfficiency = remoteModels.length > 0 ?
        remoteModels.reduce((sum, m) => sum + m.efficiency, 0) / remoteModels.length : 0;
      
      return {
        mostEfficientModels,
        leastEfficientModels,
        averageLocalModelEfficiency,
        averageRemoteModelEfficiency
      };
    } catch (error) {
      logger.error('Error generating resource efficiency report:', error);
      return {
        mostEfficientModels: [],
        leastEfficientModels: [],
        averageLocalModelEfficiency: 0,
        averageRemoteModelEfficiency: 0
      };
    }
  }
};