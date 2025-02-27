import axios from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { ApiUsage, CostEstimate, Model } from '../../types/index.js';
import { openRouterModule } from '../openrouter/index.js';

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
    
    // Model context window sizes (in tokens)
    // These are approximate values and should be updated with accurate information
    const modelContextWindows: Record<string, number> = {
      // LM Studio models
      'llama3': 8192,
      'llama3-8b': 8192,
      'llama3-70b': 8192,
      'mistral-7b': 8192,
      'mixtral-8x7b': 32768,
      'qwen2.5-coder-3b-instruct': 32768,
      'qwen2.5-7b-instruct': 32768,
      'qwen2.5-72b-instruct': 32768,
      'phi-3-mini-4k': 4096,
      'phi-3-medium-4k': 4096,
      'phi-3-small-8k': 8192,
      'gemma-7b': 8192,
      'gemma-2b': 8192,
      
      // Ollama models
      'llama3:8b': 8192,
      'llama3:70b': 8192,
      'mistral': 8192,
      'mixtral': 32768,
      'qwen2:7b': 32768,
      'qwen2:72b': 32768,
      'phi3:mini': 4096,
      'phi3:small': 8192,
      'gemma:7b': 8192,
      'gemma:2b': 8192,
      
      // Default fallbacks
      'default': 4096
    };
    
    // Try to get models from LM Studio
    try {
      const lmStudioResponse = await axios.get(`${config.lmStudioEndpoint}/models`);
      if (lmStudioResponse.data && Array.isArray(lmStudioResponse.data.data)) {
        const lmStudioModels = lmStudioResponse.data.data.map((model: any) => {
          // Try to determine context window size
          let contextWindow = 4096; // Default fallback
          
          // Check if we have a known context window size for this model
          const modelId = model.id.toLowerCase();
          for (const [key, value] of Object.entries(modelContextWindows)) {
            if (modelId.includes(key.toLowerCase())) {
              contextWindow = value;
              break;
            }
          }
          
          return {
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
            contextWindow
          };
        });
        models.push(...lmStudioModels);
      }
    } catch (error) {
      logger.warn('Failed to get models from LM Studio:', error);
    }
    
    // Try to get models from Ollama
    try {
      const ollamaResponse = await axios.get(`${config.ollamaEndpoint}/tags`);
      if (ollamaResponse.data && Array.isArray(ollamaResponse.data.models)) {
        const ollamaModels = ollamaResponse.data.models.map((model: any) => {
          // Try to determine context window size
          let contextWindow = 4096; // Default fallback
          
          // Check if we have a known context window size for this model
          const modelName = model.name.toLowerCase();
          for (const [key, value] of Object.entries(modelContextWindows)) {
            if (modelName.includes(key.toLowerCase())) {
              contextWindow = value;
              break;
            }
          }
          
          // Try to get more detailed model info from Ollama
          try {
            // This is an async operation inside a map, which isn't ideal
            // In a production environment, we might want to use Promise.all
            // or restructure this to avoid the nested async call
            axios.get(`${config.ollamaEndpoint}/show`, { params: { name: model.name } })
              .then(response => {
                if (response.data && response.data.parameters) {
                  // Some Ollama models expose context_length or context_window
                  const ctxLength = response.data.parameters.context_length ||
                                    response.data.parameters.context_window;
                  if (ctxLength && typeof ctxLength === 'number') {
                    contextWindow = ctxLength;
                  }
                }
              })
              .catch(err => {
                logger.debug(`Failed to get detailed info for Ollama model ${model.name}:`, err);
              });
          } catch (detailError) {
            logger.debug(`Error getting detailed info for Ollama model ${model.name}:`, detailError);
          }
          
          return {
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
            contextWindow
          };
        });
        models.push(...ollamaModels);
      }
    } catch (error) {
      logger.warn('Failed to get models from Ollama:', error);
    }
    
    // Try to get models from OpenRouter
    try {
      // Only try to get OpenRouter models if API key is configured
      if (config.openRouterApiKey) {
        // Initialize the OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize();
        }
        
        // Get all models from OpenRouter
        const openRouterModels = await openRouterModule.getAvailableModels();
        
        // Add the models to our list
        models.push(...openRouterModels);
        
        logger.debug(`Added ${openRouterModels.length} models from OpenRouter`);
      }
    } catch (error) {
      logger.warn('Failed to get models from OpenRouter:', error);
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
        contextWindow: 8192 // Default context window for Llama 3
      });
    }
    
    return models;
  },
  
  /**
   * Get free models from OpenRouter
   * @param forceUpdate Optional flag to force update of models regardless of timestamp
   */
  async getFreeModels(forceUpdate = false): Promise<Model[]> {
    logger.debug(`Getting free models (forceUpdate=${forceUpdate})`);
    
    try {
      // Only try to get OpenRouter models if API key is configured
      if (config.openRouterApiKey) {
        // Initialize the OpenRouter module if needed
        if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
          await openRouterModule.initialize(forceUpdate);
        }
        
        // Get free models from OpenRouter with forceUpdate parameter
        const freeModels = await openRouterModule.getFreeModels(forceUpdate);
        
        // If no free models were found and we didn't already force an update, try clearing tracking data
        if (freeModels.length === 0 && !forceUpdate) {
          logger.info('No free models found, clearing tracking data and forcing update...');
          await openRouterModule.clearTrackingData();
          return await openRouterModule.getFreeModels();
        }
        
        // Log information about free models
        if (freeModels.length > 0) {
          logger.info(`Found ${freeModels.length} free models from OpenRouter`);
          
          // Group models by provider for better logging
          const providerGroups: Record<string, string[]> = {};
          for (const model of freeModels) {
            const provider = this.getProviderFromModelId(model.id);
            if (!providerGroups[provider]) {
              providerGroups[provider] = [];
            }
            providerGroups[provider].push(model.id);
          }
          
          // Log provider groups
          for (const [provider, models] of Object.entries(providerGroups)) {
            logger.debug(`Provider ${provider}: ${models.length} free models`);
          }
          
          // Log models with large context windows
          const largeContextModels = freeModels.filter(model =>
            model.contextWindow && model.contextWindow >= 32000
          );
          
          if (largeContextModels.length > 0) {
            logger.debug(`Found ${largeContextModels.length} free models with large context windows (32K+):`);
            for (const model of largeContextModels.slice(0, 5)) {
              logger.debug(`- ${model.id} (${model.contextWindow} tokens)`);
            }
            if (largeContextModels.length > 5) {
              logger.debug(`... and ${largeContextModels.length - 5} more large context models`);
            }
          }
        } else {
          logger.warn('No free models found from OpenRouter');
        }
        
        return freeModels;
      }
    } catch (error) {
      logger.warn('Failed to get free models from OpenRouter:', error);
    }
    
    return [];
  },
  
  /**
   * Extract provider name from model ID
   * This is a helper function to categorize models by provider
   */
  getProviderFromModelId(modelId: string): string {
    if (modelId.includes('openai')) return 'OpenAI';
    if (modelId.includes('anthropic')) return 'Anthropic';
    if (modelId.includes('claude')) return 'Anthropic';
    if (modelId.includes('google')) return 'Google';
    if (modelId.includes('gemini')) return 'Google';
    if (modelId.includes('mistral')) return 'Mistral';
    if (modelId.includes('meta')) return 'Meta';
    if (modelId.includes('llama')) return 'Meta';
    if (modelId.includes('deepseek')) return 'DeepSeek';
    if (modelId.includes('microsoft')) return 'Microsoft';
    if (modelId.includes('phi-3')) return 'Microsoft';
    if (modelId.includes('qwen')) return 'Qwen';
    if (modelId.includes('nvidia')) return 'NVIDIA';
    if (modelId.includes('openchat')) return 'OpenChat';
    return 'Other';
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
    
    // For local models, the cost is always 0
    const localCost = {
      prompt: 0,
      completion: 0,
      total: 0,
      currency: 'USD',
    };
    
    // For paid APIs, calculate the cost based on token counts
    // These are example rates for GPT-3.5-turbo
    let promptCost = contextLength * 0.000001;
    let completionCost = outputLength * 0.000002;
    
    // If a specific model was requested, try to get its actual cost
    if (model) {
      // Check if it's an OpenRouter model
      if (config.openRouterApiKey && openRouterModule.modelTracking.models[model]) {
        const openRouterModel = openRouterModule.modelTracking.models[model];
        promptCost = contextLength * openRouterModel.costPerToken.prompt;
        completionCost = outputLength * openRouterModel.costPerToken.completion;
        
        // If it's a free model, set costs to 0
        if (openRouterModel.isFree) {
          promptCost = 0;
          completionCost = 0;
        }
      }
    } else {
      // If no specific model was requested, check if there are free models available
      if (config.openRouterApiKey) {
        const freeModels = await this.getFreeModels();
        if (freeModels.length > 0) {
          // We have free models available, so we can set the paid cost to 0
          // This will make the recommendation favor the free models
          promptCost = 0;
          completionCost = 0;
        }
      }
    }
    
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