import { logger } from '../../../utils/logger.js';
import { costMonitor } from '../../cost-monitor/index.js';
import { modelsDbService } from './modelsDb.js';
import { CodeSubtask } from '../types/codeTask.js';
import { Model } from '../../../types/index.js';
import { COMPLEXITY_THRESHOLDS } from '../types/index.js';
import { config } from '../../../config/index.js';

/**
 * Service for selecting appropriate models for code subtasks
 */
export const codeModelSelector = {
  /**
   * Find the best model for a specific code subtask
   * 
   * @param subtask The code subtask to find a model for
   * @returns The selected model, or null if no suitable model is found
   */
  async findBestModelForSubtask(subtask: CodeSubtask): Promise<Model | null> {
    logger.debug(`Finding best model for subtask: ${subtask.description}`);
    
    try {
      // Get available models from both local and remote sources
      const availableModels = await costMonitor.getAvailableModels();
      const freeModels = await costMonitor.getFreeModels();
      const allModels = [...availableModels, ...freeModels];
      
      // Filter models that can handle the token requirements
      const suitableModels = allModels.filter(model => {
        // Only consider models that can handle the token requirements
        const hasEnoughContext = !model.contextWindow || 
          model.contextWindow >= subtask.estimatedTokens;
          
        return hasEnoughContext;
      });
      
      if (suitableModels.length === 0) {
        logger.warn(`No models found that can handle subtask with ${subtask.estimatedTokens} tokens`);
        return null;
      }
      
      // Score all suitable models
      const scoredModels = await Promise.all(
        suitableModels.map(async model => {
          const score = await this.scoreModelForSubtask(model, subtask);
          return { model, score };
        })
      );
      
      // Sort by score (descending) and return the best model
      scoredModels.sort((a, b) => b.score - a.score);
      
      logger.debug(`Best model for subtask: ${scoredModels[0].model.id} with score ${scoredModels[0].score}`);
      return scoredModels[0].model;
    } catch (error) {
      logger.error('Error finding best model for subtask:', error);
      return this.getFallbackModel(subtask);
    }
  },
  
  /**
   * Score a model for a specific code subtask
   * 
   * @param model The model to score
   * @param subtask The subtask to score for
   * @returns A score from 0 to 1, higher is better
   */
  async scoreModelForSubtask(model: Model, subtask: CodeSubtask): Promise<number> {
    // Get the models database for performance data
    const modelsDb = modelsDbService.getDatabase();
    const modelData = modelsDb.models[model.id];
    
    let score = 0;
    
    // Consider model's benchmark performance if available
    if (modelData && modelData.benchmarkCount > 0) {
      // Quality score (0-1)
      score += modelData.qualityScore * 0.3;
      
      // Success rate (0-1)
      score += modelData.successRate * 0.2;
      
      // Response time factor (0-1, inversely proportional)
      const responseTimeFactor = Math.max(0, 1 - (modelData.avgResponseTime / 15000));
      score += responseTimeFactor * 0.15;
      
      // Complexity match factor (0-1)
      const complexityMatchFactor = 1 - Math.abs(modelData.complexityScore - subtask.complexity);
      score += complexityMatchFactor * 0.15;
    } else {
      // If no performance data, use heuristics
      
      // Check if model name indicates it's good for code
      if (model.id.toLowerCase().includes('code') || 
          model.id.toLowerCase().includes('coder') ||
          model.id.toLowerCase().includes('starcoder') ||
          model.id.toLowerCase().includes('deepseek')) {
        score += 0.3;
      }
      
      // Check if it's an instruct model (better for following instructions)
      if (model.id.toLowerCase().includes('instruct')) {
        score += 0.2;
      }
      
      // Model size heuristics based on subtask complexity and recommended size
      if (subtask.recommendedModelSize === 'small' && 
          (model.id.toLowerCase().includes('1b') || 
           model.id.toLowerCase().includes('3b') ||
           model.id.toLowerCase().includes('mini') ||
           model.id.toLowerCase().includes('tiny'))) {
        score += 0.2;
      } else if (subtask.recommendedModelSize === 'medium' &&
                (model.id.toLowerCase().includes('7b') || 
                 model.id.toLowerCase().includes('8b') ||
                 model.id.toLowerCase().includes('13b'))) {
        score += 0.2;
      } else if (subtask.recommendedModelSize === 'large' &&
                (model.id.toLowerCase().includes('70b') || 
                 model.id.toLowerCase().includes('40b') ||
                 model.id.toLowerCase().includes('34b'))) {
        score += 0.2;
      }
    }
    
    // Cost factor - prefer free or local models for appropriate tasks
    if (model.provider === 'local' || model.provider === 'lm-studio' || model.provider === 'ollama') {
      // For local models, give higher scores to smaller tasks
      if (subtask.complexity < COMPLEXITY_THRESHOLDS.MEDIUM) {
        score += 0.3;
      } else if (subtask.complexity < COMPLEXITY_THRESHOLDS.COMPLEX) {
        score += 0.15;
      }
    } else if (model.costPerToken.prompt === 0 && model.costPerToken.completion === 0) {
      // Free remote models get a boost
      score += 0.25;
    } else {
      // For paid models, only give a boost for complex tasks
      if (subtask.complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
        score += 0.3;
      }
    }
    
    // Code type specific boosts
    if (subtask.codeType === 'test' && model.id.toLowerCase().includes('test')) {
      score += 0.1;
    } else if (subtask.codeType === 'interface' && model.id.toLowerCase().includes('phi')) {
      // Phi models are often good at generating interfaces
      score += 0.1;
    }
    
    return Math.min(score, 1.0); // Cap at 1.0
  },
  
  /**
   * Get a fallback model for a subtask if no suitable model is found
   * 
   * @param subtask The code subtask
   * @returns A fallback model
   */
  async getFallbackModel(subtask: CodeSubtask): Promise<Model | null> {
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
  },
  
  /**
   * Select models for all subtasks in a decomposed task
   * 
   * @param subtasks Array of code subtasks
   * @param useResourceEfficient Whether to prioritize resource efficiency
   * @returns A map of subtask ID to selected model
   */
  async selectModelsForSubtasks(
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
        
        const model = await this.findBestModelForSubtask(representativeTask);
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
        const model = await this.findBestModelForSubtask(subtask);
        if (model) {
          modelAssignments.set(subtask.id, model);
        }
      }
    }
    
    return modelAssignments;
  }
};