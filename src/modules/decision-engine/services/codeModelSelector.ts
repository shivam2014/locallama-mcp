import { logger } from '../../../utils/logger.js';
import { costMonitor } from '../../cost-monitor/index.js';
import { modelsDbService } from './modelsDb.js';
import { modelPerformanceTracker } from './modelPerformance.js';
import { CodeSubtask } from '../types/codeTask.js';
import { Model } from '../../../types/index.js';
import { COMPLEXITY_THRESHOLDS } from '../types/index.js';
import { config } from '../../../config/index.js';

/**
 * Service for selecting appropriate models for code subtasks
 * Enhanced with adaptive scoring and performance tracking
 */
export const codeModelSelector = {
  // Public methods for external use
  findBestModelForSubtask,
  scoreModelForSubtask,
  getFallbackModel,
  selectModelsForSubtasks,

  // Internal helper methods
  calculateComplexityMatchScore(
    model: Model,
    subtask: CodeSubtask,
    modelStats: any
  ): number {
    let score = 0;

    // Use historical complexity match if available
    if (modelStats?.complexityScore !== undefined) {
      score += 1 - Math.abs(modelStats.complexityScore - subtask.complexity);
    }

    // Model size appropriateness
    if (subtask.recommendedModelSize === 'small') {
      if (model.id.toLowerCase().match(/1\.5b|1b|3b|mini|tiny/)) score += 0.3;
    } else if (subtask.recommendedModelSize === 'medium') {
      if (model.id.toLowerCase().match(/7b|8b|13b/)) score += 0.3;
    } else if (subtask.recommendedModelSize === 'large') {
      if (model.id.toLowerCase().match(/70b|40b|34b/)) score += 0.3;
    }

    return score;
  },

  calculateHistoricalPerformanceScore(
    model: Model,
    modelStats: any,
    perfAnalysis: any
  ): number {
    let score = 0;

    if (modelStats) {
      // Success rate compared to average
      if (modelStats.successRate > perfAnalysis.averageSuccessRate) {
        score += 0.4;
      }

      // Quality score compared to average
      if (modelStats.qualityScore > perfAnalysis.averageQualityScore) {
        score += 0.4;
      }

      // Bonus for being among best performing models
      if (perfAnalysis.bestPerformingModels.includes(model.id)) {
        score += 0.2;
      }
    } else {
      // No history - use model characteristics as proxy
      if (model.id.toLowerCase().match(/code|coder|starcoder|deepseek/)) {
        score += 0.3;
      }
      if (model.id.toLowerCase().includes('instruct')) {
        score += 0.2;
      }
    }

    return score;
  },

  calculateResourceEfficiencyScore(
    model: Model,
    subtask: CodeSubtask,
    modelStats: any
  ): number {
    let score = 0;

    // Response time efficiency if available
    if (modelStats?.avgResponseTime) {
      score += Math.max(0, 1 - (modelStats.avgResponseTime / 15000));
    }

    // Context window efficiency
    if (model.contextWindow) {
      const windowEfficiency = subtask.estimatedTokens / model.contextWindow;
      score += Math.min(1, windowEfficiency * 2); // Better score for more efficient window usage
    }

    // Provider-based efficiency
    if (model.provider === 'local' || model.provider === 'lm-studio' || model.provider === 'ollama') {
      score += 0.3; // Local models are generally more resource-efficient
    }

    return score;
  },

  calculateCostEffectivenessScore(model: Model, subtask: CodeSubtask): number {
    let score = 0;

    // Free models get high base score
    if (model.costPerToken.prompt === 0 && model.costPerToken.completion === 0) {
      score += 0.8;
    } else {
      // For paid models, score based on complexity appropriateness
      if (subtask.complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
        score += 0.6; // Worth the cost for complex tasks
      } else if (subtask.complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
        score += 0.3; // Maybe worth it for medium tasks
      }
    }

    return score;
  },

  applyCapabilityBoosts(score: number, model: Model, subtask: CodeSubtask): number {
    // Boost for specialized code models
    if (model.id.toLowerCase().match(/code|coder|starcoder|deepseek/)) {
      score += 0.1;
    }

    // Task-specific boosts
    if (subtask.codeType === 'test' && model.id.toLowerCase().includes('test')) {
      score += 0.1;
    } else if (subtask.codeType === 'interface' && model.id.toLowerCase().includes('phi')) {
      score += 0.1;
    }

    return score;
  }
};

// Define the main public methods outside the object and then attach them
async function findBestModelForSubtask(subtask: CodeSubtask): Promise<Model | null> {
  logger.debug(`Finding best model for subtask: ${subtask.description}`);
  
  try {
    // Get available models from both local and remote sources
    const availableModels = await costMonitor.getAvailableModels();
    const freeModels = await costMonitor.getFreeModels();
    const allModels = [...availableModels, ...freeModels];
    
    // Filter models that can handle the token requirements
    const suitableModels = allModels.filter(model => {
      return !model.contextWindow || model.contextWindow >= subtask.estimatedTokens;
    });
    
    if (suitableModels.length === 0) {
      logger.warn(`No models found that can handle subtask with ${subtask.estimatedTokens}`);
      return codeModelSelector.getFallbackModel(subtask);
    }
    
    // Get performance analysis for this complexity range
    const perfAnalysis = modelPerformanceTracker.analyzePerformanceByComplexity(
      Math.max(0, subtask.complexity - 0.1),
      Math.min(1, subtask.complexity + 0.1)
    );
    
    // Score all suitable models with enhanced scoring system
    const scoredModels = await Promise.all(
      suitableModels.map(async model => {
        const score = await codeModelSelector.scoreModelForSubtask(model, subtask, perfAnalysis);
        return { model, score };
      })
    );
    
    // Sort by score (descending) and return the best model
    scoredModels.sort((a, b) => b.score - a.score);
    
    if (scoredModels[0].score >= 0.4) { // Reasonable confidence threshold
      logger.debug(`Best model for subtask: ${scoredModels[0].model.id} with score ${scoredModels[0].score}`);
      return scoredModels[0].model;
    }
    
    // If no model scores well enough, try fallback
    return codeModelSelector.getFallbackModel(subtask);
  } catch (error) {
    logger.error('Error finding best model for subtask:', error);
    return codeModelSelector.getFallbackModel(subtask);
  }
}

async function scoreModelForSubtask(
  model: Model, 
  subtask: CodeSubtask,
  perfAnalysis: {
    averageSuccessRate: number;
    averageQualityScore: number;
    averageResponseTime: number;
    bestPerformingModels: string[];
  }
): Promise<number> {
  const modelStats = modelPerformanceTracker.getModelStats(model.id);
  let score = 0;
  
  // Task Complexity Match (30%)
  const complexityScore = codeModelSelector.calculateComplexityMatchScore(model, subtask, modelStats);
  score += complexityScore * 0.3;
  
  // Historical Performance (25%)
  const historyScore = codeModelSelector.calculateHistoricalPerformanceScore(model, modelStats, perfAnalysis);
  score += historyScore * 0.25;
  
  // Resource Efficiency (25%)
  const efficiencyScore = codeModelSelector.calculateResourceEfficiencyScore(model, subtask, modelStats);
  score += efficiencyScore * 0.25;
  
  // Cost Effectiveness (20%)
  const costScore = codeModelSelector.calculateCostEffectivenessScore(model, subtask);
  score += costScore * 0.2;
  
  // Additional boosts for specific capabilities
  score = codeModelSelector.applyCapabilityBoosts(score, model, subtask);
  
  return Math.min(score, 1.0);
}

async function getFallbackModel(subtask: CodeSubtask): Promise<Model | null> {
  logger.debug('Using fallback model selection for subtask');
  
  try {
    // Use size-based selection as a fallback
    switch (subtask.recommendedModelSize) {
      case 'small':
        return {
          id: config.defaultLocalModel,
          name: 'Default Local Model',
          provider: 'local',
          capabilities: {
            chat: true,
            completion: true
          },
          costPerToken: {
            prompt: 0,
            completion: 0
          }
        };
      
      case 'medium':
        // Try to find a medium-sized local model
        const localModels = await costMonitor.getAvailableModels();
        const mediumModel = localModels.find(m => 
          m.provider === 'local' || 
          m.provider === 'lm-studio' || 
          m.provider === 'ollama'
        );
        
        return mediumModel || {
          id: config.defaultLocalModel,
          name: 'Default Local Model',
          provider: 'local',
          capabilities: {
            chat: true,
            completion: true
          },
          costPerToken: {
            prompt: 0,
            completion: 0
          }
        };
      
      case 'large':
      case 'remote':
        return {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          capabilities: {
            chat: true,
            completion: true
          },
          costPerToken: {
            prompt: 0.000001,
            completion: 0.000002
          }
        };
        
      default:
        return {
          id: config.defaultLocalModel,
          name: 'Default Local Model',
          provider: 'local',
          capabilities: {
            chat: true,
            completion: true
          },
          costPerToken: {
            prompt: 0,
            completion: 0
          }
        };
    }
  } catch (error) {
    logger.error('Error getting fallback model:', error);
    
    // Ultimate fallback - just return whatever config says is the default
    return {
      id: config.defaultLocalModel,
      name: 'Default Local Model',
      provider: 'local',
      capabilities: {
        chat: true,
        completion: true
      },
      costPerToken: {
        prompt: 0,
        completion: 0
      }
    };
  }
}

async function selectModelsForSubtasks(
  subtasks: CodeSubtask[], 
  useResourceEfficient: boolean = false
): Promise<Map<string, Model>> {
  const modelAssignments = new Map<string, Model>();
  
  if (useResourceEfficient) {
    // Resource-efficient approach: Group similar subtasks and assign the same model
    // Group by complexity and recommended model size
    const groups = new Map<string, CodeSubtask[]>();
    
    subtasks.forEach(subtask => {
      const key = `${subtask.recommendedModelSize}-${Math.round(subtask.complexity * 10) / 10}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(subtask);
    });
    
    // Assign models to each group
    for (const [_, subtaskGroup] of groups.entries()) {
      // Use the most complex task in the group to find a model
      const representativeTask = subtaskGroup.reduce(
        (most, current) => current.complexity > most.complexity ? current : most,
        subtaskGroup[0]
      );
      
      const model = await codeModelSelector.findBestModelForSubtask(representativeTask);
      if (model) {
        // Assign this model to all tasks in the group
        subtaskGroup.forEach(subtask => {
          modelAssignments.set(subtask.id, model);
        });
      }
    }
  } else {
    // Individual assignment approach: Find the best model for each subtask
    for (const subtask of subtasks) {
      const model = await codeModelSelector.findBestModelForSubtask(subtask);
      if (model) {
        modelAssignments.set(subtask.id, model);
      }
    }
  }
  
  return modelAssignments;
}