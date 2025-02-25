import axios from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ApiUsage, CostEstimate, Model } from '../../types/index.js';

/**
 * Cost & Token Monitoring Module
 * 
 * This module is responsible for:
 * - Monitoring token usage and costs
 * - Estimating costs for tasks
 * - Retrieving available models
 */
export const costMonitor = {
  /**
   * Get usage statistics for a specific API
   */
  async getApiUsage(api: string): Promise<ApiUsage> {
    logger.debug(`Getting usage for API: ${api}`);
    
    // This is a placeholder implementation
    // In a real implementation, this would query the API for usage data
    return {
      api,
      tokenUsage: {
        prompt: 1000000,
        completion: 500000,
        total: 1500000,
      },
      cost: {
        prompt: 0.01,
        completion: 0.02,
        total: 0.03,
      },
      timestamp: new Date().toISOString(),
    };
  },
  
  /**
   * Get a list of available models
   */
  async getAvailableModels(): Promise<Model[]> {
    logger.debug('Getting available models');
    
    const models: Model[] = [];
    
    // Try to get models from LM Studio
    try {
      const lmStudioResponse = await axios.get(`${config.lmStudioEndpoint}/models`);
      if (lmStudioResponse.data && Array.isArray(lmStudioResponse.data.data)) {
        const lmStudioModels = lmStudioResponse.data.data.map((model: any) => ({
          id: model.id,
          name: model.id,
          provider: 'lm-studio',
          capabilities: {
            chat: true,
            completion: true,
          },
          costPerToken: {
            prompt: 0,
            completion: 0,
          },
        }));
        models.push(...lmStudioModels);
      }
    } catch (error) {
      logger.warn('Failed to get models from LM Studio:', error);
    }
    
    // Try to get models from Ollama
    try {
      const ollamaResponse = await axios.get(`${config.ollamaEndpoint}/tags`);
      if (ollamaResponse.data && Array.isArray(ollamaResponse.data.models)) {
        const ollamaModels = ollamaResponse.data.models.map((model: any) => ({
          id: model.name,
          name: model.name,
          provider: 'ollama',
          capabilities: {
            chat: true,
            completion: true,
          },
          costPerToken: {
            prompt: 0,
            completion: 0,
          },
        }));
        models.push(...ollamaModels);
      }
    } catch (error) {
      logger.warn('Failed to get models from Ollama:', error);
    }
    
    // If no models were found, return some default models
    if (models.length === 0) {
      models.push({
        id: 'llama3',
        name: 'Llama 3',
        provider: 'local',
        capabilities: {
          chat: true,
          completion: true,
        },
        costPerToken: {
          prompt: 0,
          completion: 0,
        },
      });
    }
    
    return models;
  },
  
  /**
   * Estimate the cost for a task
   */
  async estimateCost(params: {
    contextLength: number;
    outputLength?: number;
    model?: string;
  }): Promise<CostEstimate> {
    const { contextLength, outputLength = 0, model } = params;
    logger.debug(`Estimating cost for task with context length ${contextLength} and output length ${outputLength}`);
    
    // This is a placeholder implementation
    // In a real implementation, this would calculate the cost based on the model and token counts
    
    // For local models, the cost is always 0
    const localCost = {
      prompt: 0,
      completion: 0,
      total: 0,
      currency: 'USD',
    };
    
    // For paid APIs, calculate the cost based on token counts
    // These are example rates for GPT-3.5-turbo
    const promptCost = contextLength * 0.000001;
    const completionCost = outputLength * 0.000002;
    const paidCost = {
      prompt: promptCost,
      completion: completionCost,
      total: promptCost + completionCost,
      currency: 'USD',
    };
    
    return {
      local: {
        cost: localCost,
        tokenCount: {
          prompt: contextLength,
          completion: outputLength,
          total: contextLength + outputLength,
        },
      },
      paid: {
        cost: paidCost,
        tokenCount: {
          prompt: contextLength,
          completion: outputLength,
          total: contextLength + outputLength,
        },
      },
      recommendation: paidCost.total > config.costThreshold ? 'local' : 'paid',
    };
  },
};