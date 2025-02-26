import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { Model } from '../../types/index.js';
import { 
  OpenRouterModel, 
  OpenRouterModelsResponse, 
  OpenRouterErrorResponse, 
  OpenRouterModelTracking,
  PromptingStrategy,
  OpenRouterErrorType
} from './types.js';

// File path for storing OpenRouter model tracking data
const TRACKING_FILE_PATH = path.join(config.rootDir, 'openrouter-models.json');

// Default prompting strategies for different model families
const DEFAULT_PROMPTING_STRATEGIES: Record<string, Partial<PromptingStrategy>> = {
  'openai': {
    systemPrompt: 'You are a helpful assistant.',
    useChat: true
  },
  'anthropic': {
    systemPrompt: 'You are Claude, a helpful AI assistant.',
    useChat: true
  },
  'google': {
    systemPrompt: 'You are a helpful AI assistant.',
    useChat: true
  },
  'mistral': {
    systemPrompt: 'You are a helpful AI assistant.',
    useChat: true
  },
  'default': {
    systemPrompt: 'You are a helpful AI assistant.',
    useChat: true
  }
};

/**
 * OpenRouter Module
 * 
 * This module is responsible for:
 * - Querying OpenRouter for available models
 * - Tracking free models
 * - Handling errors from OpenRouter
 * - Determining the best prompting strategy for each model
 */
export const openRouterModule = {
  // In-memory cache of model tracking data
  modelTracking: {
    models: {},
    lastUpdated: '',
    freeModels: []
  } as OpenRouterModelTracking,

  // In-memory cache of prompting strategies
  promptingStrategies: {} as Record<string, PromptingStrategy>,

  /**
   * Initialize the OpenRouter module
   * Loads tracking data from disk if available
   */
  async initialize(): Promise<void> {
    logger.debug('Initializing OpenRouter module');
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return;
      }
      
      // Load tracking data from disk if available
      try {
        const data = await fs.readFile(TRACKING_FILE_PATH, 'utf8');
        this.modelTracking = JSON.parse(data) as OpenRouterModelTracking;
        logger.debug(`Loaded OpenRouter tracking data with ${Object.keys(this.modelTracking.models).length} models`);
      } catch (error) {
        logger.debug('No existing OpenRouter tracking data found, will create new tracking data');
        this.modelTracking = {
          models: {},
          lastUpdated: new Date().toISOString(),
          freeModels: []
        };
      }
      
      // Load prompting strategies from disk if available
      try {
        const strategiesPath = path.join(config.rootDir, 'openrouter-strategies.json');
        const data = await fs.readFile(strategiesPath, 'utf8');
        this.promptingStrategies = JSON.parse(data) as Record<string, PromptingStrategy>;
        logger.debug(`Loaded OpenRouter prompting strategies for ${Object.keys(this.promptingStrategies).length} models`);
      } catch (error) {
        logger.debug('No existing OpenRouter prompting strategies found');
        this.promptingStrategies = {};
      }
      
      // Check if we need to update the models
      const now = new Date();
      const lastUpdated = new Date(this.modelTracking.lastUpdated);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastUpdate > 24) {
        logger.info('OpenRouter models data is more than 24 hours old, updating...');
        await this.updateModels();
      } else {
        logger.debug(`OpenRouter models data is ${hoursSinceLastUpdate.toFixed(1)} hours old, no update needed`);
      }
    } catch (error) {
      logger.error('Error initializing OpenRouter module:', error);
    }
  },

  /**
   * Update the list of available models from OpenRouter
   */
  async updateModels(): Promise<void> {
    logger.debug('Updating OpenRouter models');
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return;
      }
      
      // Query OpenRouter for available models
      const response = await axios.get<OpenRouterModelsResponse>('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
          'X-Title': 'LocalLama MCP'
        }
      });
      
      // Process the response
      if (response.data && Array.isArray(response.data.data)) {
        const models = response.data.data;
        const freeModels: string[] = [];
        const updatedModels: Record<string, OpenRouterModel> = {};
        
        for (const model of models) {
          // Check if the model is free
          const isFree = model.pricing?.prompt === 0 && model.pricing?.completion === 0;
          
          // If the model is free, add it to the list
          if (isFree) {
            freeModels.push(model.id);
          }
          
          // Create or update the model in our tracking
          const existingModel = this.modelTracking.models[model.id];
          
          updatedModels[model.id] = {
            id: model.id,
            name: model.name || model.id,
            provider: this.getProviderFromModelId(model.id),
            isFree,
            contextWindow: model.context_length || 4096,
            capabilities: {
              chat: model.features?.chat || false,
              completion: model.features?.completion || false,
              vision: model.features?.vision || false
            },
            costPerToken: {
              prompt: model.pricing?.prompt || 0,
              completion: model.pricing?.completion || 0
            },
            promptingStrategy: existingModel?.promptingStrategy || {
              systemPrompt: this.getDefaultPromptingStrategy(model.id).systemPrompt,
              userPrompt: this.getDefaultPromptingStrategy(model.id).userPrompt,
              assistantPrompt: this.getDefaultPromptingStrategy(model.id).assistantPrompt,
              useChat: this.getDefaultPromptingStrategy(model.id).useChat || true
            },
            lastUpdated: new Date().toISOString(),
            version: existingModel?.version || '1.0'
          };
        }
        
        // Update the tracking data
        this.modelTracking = {
          models: updatedModels,
          lastUpdated: new Date().toISOString(),
          freeModels
        };
        
        // Save the tracking data to disk
        await this.saveTrackingData();
        
        logger.info(`Updated OpenRouter models: ${Object.keys(updatedModels).length} total, ${freeModels.length} free`);
      } else {
        logger.warn('Invalid response from OpenRouter API:', response.data);
      }
    } catch (error) {
      this.handleOpenRouterError(error as Error);
    }
  },

  /**
   * Get the provider from a model ID
   */
  getProviderFromModelId(modelId: string): string {
    if (modelId.includes('openai')) return 'openai';
    if (modelId.includes('anthropic')) return 'anthropic';
    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('google')) return 'google';
    if (modelId.includes('gemini')) return 'google';
    if (modelId.includes('mistral')) return 'mistral';
    if (modelId.includes('meta')) return 'meta';
    if (modelId.includes('llama')) return 'meta';
    return 'unknown';
  },

  /**
   * Get the default prompting strategy for a model
   */
  getDefaultPromptingStrategy(modelId: string): {
    systemPrompt?: string;
    userPrompt?: string;
    assistantPrompt?: string;
    useChat: boolean;
  } {
    const provider = this.getProviderFromModelId(modelId);
    const defaultStrategy = DEFAULT_PROMPTING_STRATEGIES[provider] || DEFAULT_PROMPTING_STRATEGIES.default;
    
    return {
      systemPrompt: defaultStrategy.systemPrompt,
      userPrompt: defaultStrategy.userPrompt,
      assistantPrompt: defaultStrategy.assistantPrompt,
      useChat: defaultStrategy.useChat || true
    };
  },

  /**
   * Save the tracking data to disk
   */
  async saveTrackingData(): Promise<void> {
    try {
      await fs.writeFile(TRACKING_FILE_PATH, JSON.stringify(this.modelTracking, null, 2));
      logger.debug('Saved OpenRouter tracking data to disk');
    } catch (error) {
      logger.error('Error saving OpenRouter tracking data:', error);
    }
  },

  /**
   * Save the prompting strategies to disk
   */
  async savePromptingStrategies(): Promise<void> {
    try {
      const strategiesPath = path.join(config.rootDir, 'openrouter-strategies.json');
      await fs.writeFile(strategiesPath, JSON.stringify(this.promptingStrategies, null, 2));
      logger.debug('Saved OpenRouter prompting strategies to disk');
    } catch (error) {
      logger.error('Error saving OpenRouter prompting strategies:', error);
    }
  },

  /**
   * Get all available models from OpenRouter
   */
  async getAvailableModels(): Promise<Model[]> {
    logger.debug('Getting available models from OpenRouter');
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return [];
      }
      
      // Check if we need to update the models
      const now = new Date();
      const lastUpdated = new Date(this.modelTracking.lastUpdated);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastUpdate > 24) {
        logger.info('OpenRouter models data is more than 24 hours old, updating...');
        await this.updateModels();
      }
      
      // Convert OpenRouter models to the common Model format
      const models: Model[] = [];
      
      for (const [modelId, model] of Object.entries(this.modelTracking.models)) {
        models.push({
          id: modelId,
          name: model.name,
          provider: 'openrouter',
          capabilities: {
            chat: model.capabilities.chat,
            completion: model.capabilities.completion
          },
          costPerToken: {
            prompt: model.costPerToken.prompt,
            completion: model.costPerToken.completion
          },
          contextWindow: model.contextWindow
        });
      }
      
      return models;
    } catch (error) {
      this.handleOpenRouterError(error as Error);
      return [];
    }
  },

  /**
   * Get free models from OpenRouter
   */
  async getFreeModels(): Promise<Model[]> {
    logger.debug('Getting free models from OpenRouter');
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return [];
      }
      
      // Get all models
      const allModels = await this.getAvailableModels();
      
      // Filter for free models
      return allModels.filter(model => {
        return this.modelTracking.freeModels.includes(model.id);
      });
    } catch (error) {
      this.handleOpenRouterError(error as Error);
      return [];
    }
  },

  /**
   * Update the prompting strategy for a model based on benchmark results
   */
  async updatePromptingStrategy(
    modelId: string, 
    strategy: Partial<PromptingStrategy>,
    successRate: number,
    qualityScore: number
  ): Promise<void> {
    logger.debug(`Updating prompting strategy for model ${modelId}`);
    
    try {
      // Get the existing strategy or create a new one
      const existingStrategy = this.promptingStrategies[modelId] || {
        modelId,
        useChat: true,
        successRate: 0,
        qualityScore: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Only update if the new strategy is better
      if (successRate > existingStrategy.successRate || 
          (successRate === existingStrategy.successRate && qualityScore > existingStrategy.qualityScore)) {
        
        // Update the strategy
        this.promptingStrategies[modelId] = {
          ...existingStrategy,
          ...strategy,
          successRate,
          qualityScore,
          lastUpdated: new Date().toISOString()
        };
        
        // Update the model's prompting strategy
        if (this.modelTracking.models[modelId]) {
          this.modelTracking.models[modelId].promptingStrategy = {
            systemPrompt: strategy.systemPrompt || existingStrategy.systemPrompt,
            userPrompt: strategy.userPrompt || existingStrategy.userPrompt,
            assistantPrompt: strategy.assistantPrompt || existingStrategy.assistantPrompt,
            useChat: strategy.useChat !== undefined ? strategy.useChat : existingStrategy.useChat
          };
          
          // Save the tracking data
          await this.saveTrackingData();
        }
        
        // Save the prompting strategies
        await this.savePromptingStrategies();
        
        logger.info(`Updated prompting strategy for model ${modelId} with success rate ${successRate} and quality score ${qualityScore}`);
      } else {
        logger.debug(`Existing strategy for model ${modelId} is better (${existingStrategy.successRate}/${existingStrategy.qualityScore} vs ${successRate}/${qualityScore})`);
      }
    } catch (error) {
      logger.error(`Error updating prompting strategy for model ${modelId}:`, error);
    }
  },

  /**
   * Get the best prompting strategy for a model
   */
  getPromptingStrategy(modelId: string): PromptingStrategy | undefined {
    return this.promptingStrategies[modelId];
  },

  /**
   * Handle errors from OpenRouter
   */
  handleOpenRouterError(error: Error): OpenRouterErrorType {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<OpenRouterErrorResponse>;
      
      if (axiosError.response?.data?.error) {
        const errorData = axiosError.response.data.error;
        
        // Handle specific error types
        if (errorData.type === 'rate_limit_exceeded') {
          logger.warn('OpenRouter rate limit exceeded:', errorData.message);
          return OpenRouterErrorType.RATE_LIMIT;
        } else if (errorData.type === 'authentication_error') {
          logger.error('OpenRouter authentication error:', errorData.message);
          return OpenRouterErrorType.AUTHENTICATION;
        } else if (errorData.type === 'invalid_request_error') {
          logger.error('OpenRouter invalid request error:', errorData.message);
          return OpenRouterErrorType.INVALID_REQUEST;
        } else if (errorData.message.includes('context length')) {
          logger.warn('OpenRouter context length exceeded:', errorData.message);
          return OpenRouterErrorType.CONTEXT_LENGTH_EXCEEDED;
        } else if (errorData.message.includes('model not found')) {
          logger.warn('OpenRouter model not found:', errorData.message);
          return OpenRouterErrorType.MODEL_NOT_FOUND;
        } else {
          logger.error('OpenRouter error:', errorData.message);
          return OpenRouterErrorType.SERVER_ERROR;
        }
      } else if (axiosError.response && axiosError.response.status === 429) {
        logger.warn('OpenRouter rate limit exceeded');
        return OpenRouterErrorType.RATE_LIMIT;
      } else if (axiosError.response && (axiosError.response.status === 401 || axiosError.response.status === 403)) {
        logger.error('OpenRouter authentication error');
        return OpenRouterErrorType.AUTHENTICATION;
      } else if (axiosError.response && axiosError.response.status === 400) {
        logger.error('OpenRouter invalid request error');
        return OpenRouterErrorType.INVALID_REQUEST;
      } else if (axiosError.response && axiosError.response.status === 404) {
        logger.warn('OpenRouter resource not found');
        return OpenRouterErrorType.MODEL_NOT_FOUND;
      } else if (axiosError.response && axiosError.response.status >= 500) {
        logger.error('OpenRouter server error');
        return OpenRouterErrorType.SERVER_ERROR;
      }
    }
    
    logger.error('Unknown OpenRouter error:', error);
    return OpenRouterErrorType.UNKNOWN;
  },

  /**
   * Call OpenRouter API with a task
   */
  async callOpenRouterApi(
    modelId: string,
    task: string,
    timeout: number
  ): Promise<{
    success: boolean;
    text?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
    };
    error?: OpenRouterErrorType;
  }> {
    logger.debug(`Calling OpenRouter API for model ${modelId}`);
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return { success: false, error: OpenRouterErrorType.AUTHENTICATION };
      }
      
      // Get the model information
      const model = this.modelTracking.models[modelId];
      if (!model) {
        logger.warn(`Model ${modelId} not found in OpenRouter tracking data`);
        return { success: false, error: OpenRouterErrorType.MODEL_NOT_FOUND };
      }
      
      // Get the prompting strategy
      const strategy = this.getPromptingStrategy(modelId) || {
        modelId,
        systemPrompt: 'You are a helpful assistant.',
        useChat: true,
        successRate: 0,
        qualityScore: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Create the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Prepare the messages based on the prompting strategy
      const messages = [];
      
      if (strategy.systemPrompt) {
        messages.push({ role: 'system', content: strategy.systemPrompt });
      }
      
      if (strategy.userPrompt) {
        messages.push({ role: 'user', content: strategy.userPrompt.replace('{{task}}', task) });
      } else {
        messages.push({ role: 'user', content: task });
      }
      
      // Make the request
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelId,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.openRouterApiKey}`,
            'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
            'X-Title': 'LocalLama MCP'
          },
        }
      );
      
      clearTimeout(timeoutId);
      
      // Process the response
      if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
        return {
          success: true,
          text: response.data.choices[0].message.content,
          usage: response.data.usage,
        };
      } else {
        logger.warn('Invalid response from OpenRouter API:', response.data);
        return { success: false, error: OpenRouterErrorType.INVALID_REQUEST };
      }
    } catch (error) {
      const errorType = this.handleOpenRouterError(error as Error);
      return { success: false, error: errorType };
    }
  },

  /**
   * Benchmark a model with different prompting strategies
   */
  async benchmarkPromptingStrategies(
    modelId: string,
    task: string,
    timeout: number
  ): Promise<{
    bestStrategy: PromptingStrategy;
    success: boolean;
    text?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
    };
  }> {
    logger.debug(`Benchmarking prompting strategies for model ${modelId}`);
    
    try {
      // Check if API key is configured
      if (!config.openRouterApiKey) {
        logger.warn('OpenRouter API key not configured, free models will not be available');
        return { 
          bestStrategy: {
            modelId,
            systemPrompt: 'You are a helpful assistant.',
            useChat: true,
            successRate: 0,
            qualityScore: 0,
            lastUpdated: new Date().toISOString()
          },
          success: false
        };
      }
      
      // Get the model information
      const model = this.modelTracking.models[modelId];
      if (!model) {
        logger.warn(`Model ${modelId} not found in OpenRouter tracking data`);
        return { 
          bestStrategy: {
            modelId,
            systemPrompt: 'You are a helpful assistant.',
            useChat: true,
            successRate: 0,
            qualityScore: 0,
            lastUpdated: new Date().toISOString()
          },
          success: false
        };
      }
      
      // Define different prompting strategies to try
      const strategiesToTry: Partial<PromptingStrategy>[] = [
        // Default strategy
        {
          systemPrompt: 'You are a helpful assistant.',
          useChat: true
        },
        // Code-focused strategy
        {
          systemPrompt: 'You are a helpful coding assistant. Provide clear, concise code solutions.',
          useChat: true
        },
        // Detailed strategy
        {
          systemPrompt: 'You are a helpful assistant. Provide detailed, step-by-step explanations.',
          useChat: true
        },
        // Provider-specific strategy
        DEFAULT_PROMPTING_STRATEGIES[this.getProviderFromModelId(modelId)] || DEFAULT_PROMPTING_STRATEGIES.default
      ];
      
      // Try each strategy
      let bestStrategy: PromptingStrategy | null = null;
      let bestResponse: { success: boolean; text?: string; usage?: any } | null = null;
      let bestQualityScore = 0;
      
      for (const strategy of strategiesToTry) {
        // Create a temporary strategy
        const tempStrategy: PromptingStrategy = {
          modelId,
          systemPrompt: strategy.systemPrompt,
          userPrompt: strategy.userPrompt,
          assistantPrompt: strategy.assistantPrompt,
          useChat: strategy.useChat !== undefined ? strategy.useChat : true,
          successRate: 0,
          qualityScore: 0,
          lastUpdated: new Date().toISOString()
        };
        
        // Try the strategy
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          // Prepare the messages based on the prompting strategy
          const messages = [];
          
          if (tempStrategy.systemPrompt) {
            messages.push({ role: 'system', content: tempStrategy.systemPrompt });
          }
          
          if (tempStrategy.userPrompt) {
            messages.push({ role: 'user', content: tempStrategy.userPrompt.replace('{{task}}', task) });
          } else {
            messages.push({ role: 'user', content: task });
          }
          
          // Make the request
          const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: modelId,
              messages,
              temperature: 0.7,
              max_tokens: 1000,
            },
            {
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openRouterApiKey}`,
                'HTTP-Referer': 'https://locallama-mcp.local', // Required by OpenRouter
                'X-Title': 'LocalLama MCP'
              },
            }
          );
          
          clearTimeout(timeoutId);
          
          // Process the response
          if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
            const text = response.data.choices[0].message.content;
            const qualityScore = this.evaluateQuality(task, text);
            
            // Update the strategy with the results
            tempStrategy.successRate = 1;
            tempStrategy.qualityScore = qualityScore;
            
            // Check if this is the best strategy so far
            if (qualityScore > bestQualityScore) {
              bestStrategy = tempStrategy;
              bestResponse = {
                success: true,
                text,
                usage: response.data.usage
              };
              bestQualityScore = qualityScore;
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          logger.debug(`Error trying prompting strategy for model ${modelId}:`, error);
        }
      }
      
      // If we found a good strategy, update it
      if (bestStrategy && bestQualityScore > 0) {
        await this.updatePromptingStrategy(
          modelId,
          {
            systemPrompt: bestStrategy.systemPrompt,
            userPrompt: bestStrategy.userPrompt,
            assistantPrompt: bestStrategy.assistantPrompt,
            useChat: bestStrategy.useChat
          },
          bestStrategy.successRate,
          bestStrategy.qualityScore
        );
        
        return {
          bestStrategy,
          success: true,
          text: bestResponse?.text,
          usage: bestResponse?.usage
        };
      }
      
      // If we didn't find a good strategy, return the existing one
      const existingStrategy = this.getPromptingStrategy(modelId) || {
        modelId,
        systemPrompt: 'You are a helpful assistant.',
        useChat: true,
        successRate: 0,
        qualityScore: 0,
        lastUpdated: new Date().toISOString()
      };
      
      return {
        bestStrategy: existingStrategy,
        success: false
      };
    } catch (error) {
      logger.error(`Error benchmarking prompting strategies for model ${modelId}:`, error);
      
      return {
        bestStrategy: {
          modelId,
          systemPrompt: 'You are a helpful assistant.',
          useChat: true,
          successRate: 0,
          qualityScore: 0,
          lastUpdated: new Date().toISOString()
        },
        success: false
      };
    }
  },

  /**
   * Evaluate the quality of a response
   */
  evaluateQuality(task: string, response: string): number {
    // This is a placeholder implementation
    // In a real implementation, this would use a more sophisticated evaluation method
    
    // Simple heuristics for quality evaluation:
    // 1. Response length relative to task length
    const lengthScore = Math.min(1, response.length / (task.length * 0.8));
    
    // 2. Response contains code if task asks for code
    const codeScore = task.toLowerCase().includes('code') && response.includes('```') ? 1 : 0.5;
    
    // 3. Response structure (paragraphs, bullet points, etc.)
    const structureScore = (
      response.includes('\n\n') || 
      response.includes('- ') || 
      response.includes('1. ')
    ) ? 1 : 0.7;
    
    // Combine scores with weights
    return (lengthScore * 0.4) + (codeScore * 0.3) + (structureScore * 0.3);
  }
};