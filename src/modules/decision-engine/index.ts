import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { openRouterModule } from '../openrouter/index.js';
import { logger } from '../../utils/logger.js';
import { Model, RoutingDecision, TaskRoutingParams, ModelPerformanceProfile } from '../../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';

// File path for storing model performance data
const MODELS_DB_PATH = path.join(config.rootDir, 'models-performance.json');

// Interface for model performance tracking
interface ModelPerformanceData {
  id: string;
  name: string;
  provider: string; // 'openrouter', 'local', 'lm-studio', 'ollama', etc.
  lastSeen: string;
  contextWindow: number;
  successRate: number;
  qualityScore: number;
  avgResponseTime: number;
  complexityScore: number;
  lastBenchmarked: string;
  benchmarkCount: number;
  isFree: boolean; // Whether this is a free model
}

// Interface for models database
interface ModelsDatabase {
  models: Record<string, ModelPerformanceData>;
  lastUpdated: string;
}

/**
 * Model performance profiles based on benchmark results
 * These profiles help the decision engine make more informed decisions
 * about which models to use for different types of tasks
 */
const modelPerformanceProfiles: Record<string, ModelPerformanceProfile> = {
  // Small, efficient models (good for simple tasks)
  'qwen2.5-coder-1.5b-instruct': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 3225, // milliseconds
    successRate: 1.0,
    contextWindow: 32768,
    recommendedComplexityRange: [0, 0.4]
  },
  'tinycodellama-1.3b-5k': {
    simpleTaskQuality: 0.76,
    mediumTaskQuality: 0.81,
    complexTaskQuality: 0.79,
    avgResponseTime: 6087, // milliseconds
    successRate: 1.0,
    contextWindow: 5120,
    recommendedComplexityRange: [0, 0.3]
  },
  'stable-code-instruct-3b': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 4721, // milliseconds
    successRate: 1.0,
    contextWindow: 8192,
    recommendedComplexityRange: [0, 0.5]
  },
  // Medium-sized models (good balance)
  'qwen2.5-coder-3b-instruct': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 6068, // milliseconds
    successRate: 1.0,
    contextWindow: 32768,
    recommendedComplexityRange: [0, 0.7]
  },
  'deepseek-r1-distill-qwen-1.5b': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 7366, // milliseconds
    successRate: 1.0,
    contextWindow: 8192,
    recommendedComplexityRange: [0, 0.5]
  },
  // Larger models (better for complex tasks)
  'qwen2.5-7b-instruct-1m': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 31026, // milliseconds
    successRate: 1.0,
    contextWindow: 32768,
    recommendedComplexityRange: [0.3, 0.8]
  },
  // Paid API models
  'gpt-3.5-turbo': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 3296, // milliseconds
    successRate: 1.0,
    contextWindow: 16385,
    recommendedComplexityRange: [0, 0.7]
  },
  'gpt-4o': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 13202, // milliseconds
    successRate: 1.0,
    contextWindow: 128000,
    recommendedComplexityRange: [0.5, 1.0]
  },
  'claude-3-sonnet-20240229': {
    simpleTaskQuality: 0.85,
    mediumTaskQuality: 0.85,
    complexTaskQuality: 0.85,
    avgResponseTime: 11606, // milliseconds
    successRate: 1.0,
    contextWindow: 200000,
    recommendedComplexityRange: [0.4, 1.0]
  }
};

// Complexity thresholds based on benchmark results
const COMPLEXITY_THRESHOLDS = {
  SIMPLE: 0.3,  // Tasks below this are simple
  MEDIUM: 0.6,  // Tasks below this are medium complexity
  COMPLEX: 0.8  // Tasks below this are moderately complex, above are very complex
};

// Token thresholds based on benchmark results
const TOKEN_THRESHOLDS = {
  SMALL: 500,   // Small context
  MEDIUM: 2000, // Medium context
  LARGE: 8000   // Large context
};

/**
 * Decision Engine
 *
 * This module is responsible for making decisions about routing tasks
 * between local LLMs and paid APIs based on various factors:
 * - Cost
 * - Task complexity
 * - Token usage
 * - User priority
 * - Model context window limitations
 * - Benchmark performance data
 * - Availability of free models
 */
export const decisionEngine = {
  // In-memory cache of model performance data
  modelsDb: {
    models: {},
    lastUpdated: ''
  } as ModelsDatabase,

  /**
   * Initialize the decision engine
   * This is called when the module is first loaded
   */
  async initialize(): Promise<void> {
    logger.info('Initializing decision engine');
    
    try {
      // Load models database
      await this.initializeModelsDb();
      
      // Update model performance profiles from benchmark results
      await this.updateModelPerformanceProfiles();
      
      // Check for new free models that haven't been benchmarked
      if (config.openRouterApiKey) {
        try {
          // Get free models
          const freeModels = await costMonitor.getFreeModels();
          
          // Check if we have any unbenchmarked free models
          let unbenchmarkedModels = 0;
          for (const model of freeModels) {
            if (!this.modelsDb.models[model.id] ||
                this.modelsDb.models[model.id].benchmarkCount === 0) {
              unbenchmarkedModels++;
            }
          }
          
          if (unbenchmarkedModels > 0) {
            logger.info(`Found ${unbenchmarkedModels} unbenchmarked free models`);
            
            // Schedule benchmarking to run in the background
            setTimeout(() => {
              this.benchmarkFreeModels().catch(err => {
                logger.error('Error benchmarking free models:', err);
              });
            }, 5000); // Wait 5 seconds before starting benchmarks
          }
        } catch (error) {
          logger.error('Error checking for unbenchmarked free models:', error);
        }
      }
      
      logger.info('Decision engine initialized successfully');
    } catch (error) {
      logger.error('Error initializing decision engine:', error);
    }
  },

  /**
   * Get model performance profiles
   * This allows external modules to access the performance profiles
   */
  getModelPerformanceProfiles(): Record<string, ModelPerformanceProfile> {
    return modelPerformanceProfiles;
  },

  /**
   * Initialize the models database
   * Loads tracking data from disk if available
   */
  async initializeModelsDb(): Promise<void> {
    logger.debug('Initializing models database');
    
    try {
      // Ensure the directory exists for tracking files
      try {
        await mkdir(path.dirname(MODELS_DB_PATH), { recursive: true });
        logger.debug(`Ensured directory exists: ${path.dirname(MODELS_DB_PATH)}`);
      } catch (error: any) {
        // Ignore if directory already exists
        logger.debug(`Directory check: ${error.message}`);
      }
      
      // Load tracking data from disk if available
      try {
        const data = await fs.readFile(MODELS_DB_PATH, 'utf8');
        this.modelsDb = JSON.parse(data) as ModelsDatabase;
        logger.debug(`Loaded models database with ${Object.keys(this.modelsDb.models).length} models`);
      } catch (error) {
        logger.debug('No existing models database found, will create new database');
        this.modelsDb = {
          models: {},
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Error initializing models database:', error);
    }
  },

  /**
   * Save the models database to disk
   */
  async saveModelsDb(): Promise<void> {
    try {
      logger.debug(`Saving models database to: ${MODELS_DB_PATH}`);
      logger.debug(`Database contains ${Object.keys(this.modelsDb.models).length} models`);
      
      // Ensure the directory exists
      try {
        await mkdir(path.dirname(MODELS_DB_PATH), { recursive: true });
      } catch (error: any) {
        // Ignore if directory already exists
        logger.debug(`Directory check during save: ${error.message}`);
      }
      
      await fs.writeFile(MODELS_DB_PATH, JSON.stringify(this.modelsDb, null, 2));
      logger.debug('Successfully saved models database to disk');
    } catch (error: any) {
      logger.error(`Error saving models database to ${MODELS_DB_PATH}:`, error);
      logger.error(`Error details: ${error.message}`);
    }
  },

  /**
   * Update the models database with the latest models from OpenRouter and local sources
   */
  async updateModelsDb(): Promise<void> {
    logger.debug('Updating models database');
    
    try {
      // Get free models from OpenRouter
      const freeModels = await costMonitor.getFreeModels();
      
      // Get local models
      const localModels = await costMonitor.getAvailableModels();
      const filteredLocalModels = localModels.filter(model =>
        model.provider === 'local' ||
        model.provider === 'lm-studio' ||
        model.provider === 'ollama'
      );
      
      logger.debug(`Found ${freeModels.length} free models from OpenRouter and ${filteredLocalModels.length} local models`);
      
      // Update the database with the latest models
      const now = new Date().toISOString();
      const updatedModels: Record<string, ModelPerformanceData> = {};
      
      // First, copy existing models to preserve performance data
      for (const [modelId, modelData] of Object.entries(this.modelsDb.models)) {
        updatedModels[modelId] = { ...modelData };
      }
      
      // Update or add free models from OpenRouter
      for (const model of freeModels) {
        if (updatedModels[model.id]) {
          // Update existing model
          updatedModels[model.id].lastSeen = now;
          updatedModels[model.id].name = model.name;
          updatedModels[model.id].contextWindow = model.contextWindow || 4096;
        } else {
          // Add new model
          updatedModels[model.id] = {
            id: model.id,
            name: model.name,
            provider: 'openrouter',
            lastSeen: now,
            contextWindow: model.contextWindow || 4096,
            successRate: 0,
            qualityScore: 0,
            avgResponseTime: 0,
            complexityScore: 0.5, // Default middle complexity
            lastBenchmarked: '',
            benchmarkCount: 0,
            isFree: true
          };
          logger.info(`Added new free model to database: ${model.id} (${model.name})`);
        }
      }
      
      // Update or add local models
      for (const model of filteredLocalModels) {
        if (updatedModels[model.id]) {
          // Update existing model
          updatedModels[model.id].lastSeen = now;
          updatedModels[model.id].name = model.name;
          updatedModels[model.id].contextWindow = model.contextWindow || 4096;
        } else {
          // Add new model
          updatedModels[model.id] = {
            id: model.id,
            name: model.name,
            provider: model.provider,
            lastSeen: now,
            contextWindow: model.contextWindow || 4096,
            successRate: 0,
            qualityScore: 0,
            avgResponseTime: 0,
            complexityScore: 0.5, // Default middle complexity
            lastBenchmarked: '',
            benchmarkCount: 0,
            isFree: false
          };
          logger.info(`Added new local model to database: ${model.id} (${model.name})`);
        }
      }
      
      // Update the database
      this.modelsDb = {
        models: updatedModels,
        lastUpdated: now
      };
      
      // Save the database to disk
      await this.saveModelsDb();
      
      logger.info(`Updated models database with ${Object.keys(updatedModels).length} models (${freeModels.length} free, ${filteredLocalModels.length} local)`);
    } catch (error) {
      logger.error('Error updating models database:', error);
    }
  },

  /**
   * Update model performance profiles from benchmark results
   * This allows the decision engine to learn from new benchmark data
   */
  async updateModelPerformanceProfiles(): Promise<void> {
    try {
      // Find the most recent comprehensive benchmark results
      const benchmarkDir = path.join(process.cwd(), 'benchmark-results');
      const files = await fs.readdir(benchmarkDir);
      
      // Find the most recent comprehensive results file
      const comprehensiveFiles = files.filter(file => file.startsWith('comprehensive-results-'));
      if (comprehensiveFiles.length === 0) {
        logger.warn('No comprehensive benchmark results found');
        return;
      }
      
      // Sort by timestamp (newest first)
      comprehensiveFiles.sort().reverse();
      const latestFile = comprehensiveFiles[0];
      
      // Read and parse the benchmark results
      const filePath = path.join(benchmarkDir, latestFile);
      const data = await fs.readFile(filePath, 'utf8');
      const results = JSON.parse(data);
      
      // Update model performance profiles based on benchmark results
      // This is a simplified implementation - in a real system, this would be more sophisticated
      for (const result of results) {
        // Update local model profile
        if (result.local && result.local.model) {
          const localModel = result.local.model;
          if (!modelPerformanceProfiles[localModel]) {
            modelPerformanceProfiles[localModel] = {
              simpleTaskQuality: 0,
              mediumTaskQuality: 0,
              complexTaskQuality: 0,
              avgResponseTime: 0,
              successRate: 0,
              contextWindow: 4096, // Default
              recommendedComplexityRange: [0, 0.5] // Default
            };
          }
          
          // Update profile based on task type
          const profile = modelPerformanceProfiles[localModel];
          if (result.complexity <= COMPLEXITY_THRESHOLDS.SIMPLE) {
            profile.simpleTaskQuality = result.local.qualityScore;
          } else if (result.complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
            profile.mediumTaskQuality = result.local.qualityScore;
          } else {
            profile.complexTaskQuality = result.local.qualityScore;
          }
          
          // Update response time and success rate with weighted average
          profile.avgResponseTime = (profile.avgResponseTime + result.local.timeTaken) / 2;
          profile.successRate = (profile.successRate + result.local.successRate) / 2;
          
          // Update recommended complexity range based on quality scores
          if (profile.simpleTaskQuality >= 0.8 && profile.mediumTaskQuality >= 0.8) {
            profile.recommendedComplexityRange[1] = 0.6;
          }
          if (profile.complexTaskQuality >= 0.8) {
            profile.recommendedComplexityRange[1] = 0.8;
          }
        }
        
        // Update paid model profile
        if (result.paid && result.paid.model) {
          const paidModel = result.paid.model;
          if (!modelPerformanceProfiles[paidModel]) {
            modelPerformanceProfiles[paidModel] = {
              simpleTaskQuality: 0,
              mediumTaskQuality: 0,
              complexTaskQuality: 0,
              avgResponseTime: 0,
              successRate: 0,
              contextWindow: 16385, // Default for most paid models
              recommendedComplexityRange: [0, 1.0] // Default
            };
          }
          
          // Update profile based on task type
          const profile = modelPerformanceProfiles[paidModel];
          if (result.complexity <= COMPLEXITY_THRESHOLDS.SIMPLE) {
            profile.simpleTaskQuality = result.paid.qualityScore;
          } else if (result.complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
            profile.mediumTaskQuality = result.paid.qualityScore;
          } else {
            profile.complexTaskQuality = result.paid.qualityScore;
          }
          
          // Update response time and success rate with weighted average
          profile.avgResponseTime = (profile.avgResponseTime + result.paid.timeTaken) / 2;
          profile.successRate = (profile.successRate + result.paid.successRate) / 2;
        }
      }
      
      logger.info('Updated model performance profiles from benchmark results');
    } catch (error) {
      logger.error('Error updating model performance profiles:', error);
    }
  },

  /**
   * Check if free models are available from OpenRouter
   */
  async hasFreeModels(): Promise<boolean> {
    // Only check if OpenRouter API key is configured
    if (!config.openRouterApiKey) {
      return false;
    }
    
    try {
      // Initialize OpenRouter module if needed
      if (Object.keys(openRouterModule.modelTracking.models).length === 0) {
        await openRouterModule.initialize();
      }
      
      // Get free models
      const freeModels = await costMonitor.getFreeModels();
      return freeModels.length > 0;
    } catch (error) {
      logger.error('Error checking for free models:', error);
      return false;
    }
  },

  /**
   * Get the best local model for a task
   * Uses the same metrics as free model selection (success rate, quality, speed)
   * but with local-specific optimizations
   */
  async getBestLocalModel(
    complexity: number,
    totalTokens: number
  ): Promise<Model | null> {
    try {
      // Initialize the models database if needed
      if (Object.keys(this.modelsDb.models).length === 0) {
        await this.initializeModelsDb();
      }
      
      // Get local models
      const localModels = await costMonitor.getAvailableModels();
      const filteredLocalModels = localModels.filter(model => 
        (model.provider === 'local' || model.provider === 'lm-studio' || model.provider === 'ollama') &&
        (model.contextWindow === undefined || model.contextWindow >= totalTokens)
      );
      
      if (filteredLocalModels.length === 0) {
        return null;
      }
      
      // Find the best model based on our database and complexity
      let bestModel: Model | null = null;
      let bestScore = 0;
      
      for (const model of filteredLocalModels) {
        // Calculate a base score for this model
        let score = 0;
        
        // Check if we have performance data for this model
        const modelData = this.modelsDb.models[model.id];
        
        if (modelData && modelData.benchmarkCount > 0) {
          // Calculate score based on performance data
          // Weight factors based on importance - same as free model selection
          const successRateWeight = 0.3;
          const qualityScoreWeight = 0.4;
          const responseTimeWeight = 0.3; // Increased weight for speed
          const complexityMatchWeight = 0.1;
          
          // Success rate factor (0-1)
          score += modelData.successRate * successRateWeight;
          
          // Quality score factor (0-1)
          score += modelData.qualityScore * qualityScoreWeight;
          
          // Response time factor (0-1, inversely proportional)
          // Normalize response time: faster is better
          // Assume 15000ms (15s) is the upper bound for response time
          const responseTimeFactor = Math.max(0, 1 - (modelData.avgResponseTime / 15000));
          score += responseTimeFactor * responseTimeWeight;
          
          // Complexity match factor (0-1)
          // How well does the model's complexity score match the requested complexity?
          const complexityMatchFactor = 1 - Math.abs(modelData.complexityScore - complexity);
          score += complexityMatchFactor * complexityMatchWeight;
          
          logger.debug(`Local model ${model.id} has performance data: success=${modelData.successRate.toFixed(2)}, quality=${modelData.qualityScore.toFixed(2)}, time=${modelData.avgResponseTime}ms, score=${score.toFixed(2)}`);
          
          // For local models, we also consider system resource usage
          // This is a local-specific optimization
          if (model.provider === 'local' || model.provider === 'lm-studio') {
            // Prefer models that use fewer resources for the same quality
            // This is a heuristic based on model size
            if (model.id.toLowerCase().includes('1.5b') || 
                model.id.toLowerCase().includes('1b') ||
                model.id.toLowerCase().includes('3b')) {
              score += 0.1; // Small models use fewer resources
            }
          }
        } else {
          // No performance data, use heuristics based on model size
          
          // Prefer models with "instruct" in the name for instruction-following tasks
          if (model.id.toLowerCase().includes('instruct')) {
            score += 0.1;
          }
          
          // For complex tasks, prefer larger models
          if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
            // Check for model size indicators in the name
            if (model.id.toLowerCase().includes('70b') || 
                model.id.toLowerCase().includes('65b') || 
                model.id.toLowerCase().includes('40b')) {
              score += 0.3; // Very large models
            } else if (model.id.toLowerCase().includes('13b') || 
                       model.id.toLowerCase().includes('14b') || 
                       model.id.toLowerCase().includes('7b') ||
                       model.id.toLowerCase().includes('8b')) {
              score += 0.2; // Medium-sized models
            } else if (model.id.toLowerCase().includes('3b') || 
                       model.id.toLowerCase().includes('1.5b') || 
                       model.id.toLowerCase().includes('1b')) {
              score += 0.1; // Smaller models
            }
          } else {
            // For simpler tasks, prefer smaller, more efficient models
            if (model.id.toLowerCase().includes('1.5b') || 
                model.id.toLowerCase().includes('1b') ||
                model.id.toLowerCase().includes('3b')) {
              score += 0.3; // Smaller models are more efficient
            } else if (model.id.toLowerCase().includes('7b') || 
                       model.id.toLowerCase().includes('8b')) {
              score += 0.2; // Medium models
            } else {
              score += 0.1; // Larger models
            }
          }
          
          logger.debug(`Local model ${model.id} has no performance data, using heuristics: score=${score.toFixed(2)}`);
          
          // Schedule this model for benchmarking
          // We'll do this asynchronously to avoid blocking the decision
          setTimeout(() => {
            this.benchmarkModel(model.id, complexity, model.provider).catch((err: Error) => {
              logger.error(`Error scheduling benchmark for ${model.id}:`, err);
            });
          }, 0);
        }
        
        // Update best model if this one has a higher score
        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }
      
      // If we couldn't find a best model based on scores, fall back to default
      if (!bestModel && filteredLocalModels.length > 0) {
        bestModel = filteredLocalModels[0];
      }
      
      logger.debug(`Selected best local model for complexity ${complexity.toFixed(2)} and ${totalTokens} tokens: ${bestModel?.id}`);
      return bestModel;
    } catch (error) {
      logger.error('Error getting best local model:', error);
      return null;
    }
  },

  /**
   * Benchmark a model with a simple task
   * This helps us gather performance data for models
   */
  async benchmarkModel(modelId: string, complexity: number, provider: string = 'openrouter'): Promise<void> {
    logger.debug(`Benchmarking model: ${modelId} with complexity ${complexity}`);
    
    try {
      // Check if we've already benchmarked this model recently
      const modelData = this.modelsDb.models[modelId];
      if (!modelData) {
        logger.warn(`Model ${modelId} not found in models database`);
        return;
      }
      
      // Skip if we've already benchmarked this model recently (within 7 days)
      if (modelData.lastBenchmarked) {
        const lastBenchmarked = new Date(modelData.lastBenchmarked);
        const now = new Date();
        const daysSinceLastBenchmark = (now.getTime() - lastBenchmarked.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastBenchmark < 7 && modelData.benchmarkCount >= 3) {
          logger.debug(`Skipping benchmark for ${modelId} - already benchmarked ${modelData.benchmarkCount} times, last on ${modelData.lastBenchmarked}`);
          return;
        }
      }
      
      // Generate a simple task based on complexity
      let task: string;
      if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE) {
        task = "Write a function to calculate the factorial of a number.";
      } else if (complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
        task = "Implement a binary search algorithm and explain its time complexity.";
      } else {
        task = "Design a class hierarchy for a library management system with inheritance and polymorphism.";
      }
      
      // Measure start time
      const startTime = Date.now();
      
      let result;
      if (provider === 'openrouter') {
        // Call the model using OpenRouter
        result = await openRouterModule.callOpenRouterApi(
          modelId,
          task,
          60000 // 60 second timeout
        );
      } else {
        // For local models, we would use a different API
        // This is a placeholder for future implementation
        logger.warn(`Benchmarking for provider ${provider} not yet implemented`);
        return;
      }
      
      // Measure end time
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update the model data
      if (result && result.success) {
        // Calculate quality score based on the response
        const qualityScore = openRouterModule.evaluateQuality(task, result.text || '');
        
        // Update the model data with a weighted average
        const benchmarkCount = modelData.benchmarkCount + 1;
        const weightedSuccessRate = (modelData.successRate * modelData.benchmarkCount + 1) / benchmarkCount;
        const weightedQualityScore = (modelData.qualityScore * modelData.benchmarkCount + qualityScore) / benchmarkCount;
        const weightedResponseTime = (modelData.avgResponseTime * modelData.benchmarkCount + responseTime) / benchmarkCount;
        
        // Update the model data
        this.modelsDb.models[modelId] = {
          ...modelData,
          successRate: weightedSuccessRate,
          qualityScore: weightedQualityScore,
          avgResponseTime: weightedResponseTime,
          complexityScore: complexity,
          lastBenchmarked: new Date().toISOString(),
          benchmarkCount
        };
        
        logger.info(`Successfully benchmarked ${modelId}: Quality=${qualityScore.toFixed(2)}, Time=${responseTime}ms`);
      } else if (result) {
        // Update failure rate
        const benchmarkCount = modelData.benchmarkCount + 1;
        const weightedSuccessRate = (modelData.successRate * modelData.benchmarkCount) / benchmarkCount;
        
        // Update the model data
        this.modelsDb.models[modelId] = {
          ...modelData,
          successRate: weightedSuccessRate,
          lastBenchmarked: new Date().toISOString(),
          benchmarkCount
        };
        
        logger.warn(`Failed to benchmark ${modelId}: ${result.error}`);
      }
      
      // Save the database
      await this.saveModelsDb();
    } catch (error) {
      logger.error(`Error benchmarking model ${modelId}:`, error);
    }
  },

  /**
   * Get the best free model for a task
   */
  async getBestFreeModel(
    complexity: number,
    totalTokens: number
  ): Promise<Model | null> {
    // Only check if OpenRouter API key is configured
    if (!config.openRouterApiKey) {
      return null;
    }
    
    try {
      // Initialize the models database if needed
      if (Object.keys(this.modelsDb.models).length === 0) {
        await this.initializeModelsDb();
      }
      
      // Check if we need to update the database
      const now = new Date();
      const lastUpdated = new Date(this.modelsDb.lastUpdated || now);
      const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastUpdate > 24) {
        logger.info('Models database is more than 24 hours old, updating...');
        await this.updateModelsDb();
      }
      
      // Get free models
      const freeModels = await costMonitor.getFreeModels();
      if (freeModels.length === 0) {
        return null;
      }
      
      // Filter models that can handle the context length
      const suitableModels = freeModels.filter(model => {
        return model.contextWindow && model.contextWindow >= totalTokens;
      });
      
      if (suitableModels.length === 0) {
        return null;
      }
      
      // Find the best model based on our database and complexity
      let bestModel: Model | null = null;
      let bestScore = 0;
      
      for (const model of suitableModels) {
        // Calculate a base score for this model
        let score = 0;
        
        // Check if we have performance data for this model
        const modelData = this.modelsDb.models[model.id];
        
        if (modelData && modelData.benchmarkCount > 0) {
          // Calculate score based on performance data
          // Weight factors based on importance
          const successRateWeight = 0.4;  // Increased weight for success rate
          const qualityScoreWeight = 0.4;
          const responseTimeWeight = 0.3; // Increased weight for speed
          const complexityMatchWeight = 0.1;
          
          // Success rate factor (0-1)
          score += modelData.successRate * successRateWeight;
          
          // Quality score factor (0-1)
          score += modelData.qualityScore * qualityScoreWeight;
          
          // Response time factor (0-1, inversely proportional)
          // Normalize response time: faster is better
          // Assume 15000ms (15s) is the upper bound for response time
          const responseTimeFactor = Math.max(0, 1 - (modelData.avgResponseTime / 15000));
          score += responseTimeFactor * responseTimeWeight;
          
          // Complexity match factor (0-1)
          // How well does the model's complexity score match the requested complexity?
          const complexityMatchFactor = 1 - Math.abs(modelData.complexityScore - complexity);
          score += complexityMatchFactor * complexityMatchWeight;
          
          // Boost score for models with high benchmark counts (more reliable data)
          if (modelData.benchmarkCount >= 3) {
            score += 0.1;
          }
          
          logger.debug(`Model ${model.id} has performance data: success=${modelData.successRate.toFixed(2)}, quality=${modelData.qualityScore.toFixed(2)}, time=${modelData.avgResponseTime}ms, benchmarks=${modelData.benchmarkCount}, score=${score.toFixed(2)}`);
        } else {
          // No performance data, use heuristics
          
          // Since we haven't benchmarked free models yet, give them a higher base score
          // This ensures they get selected more often for benchmarking
          score += 0.3;
          
          // Prefer models with "instruct" in the name for instruction-following tasks
          if (model.id.toLowerCase().includes('instruct')) {
            score += 0.1;
          }
          
          // Prefer models with larger context windows for complex tasks
          if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
            score += (model.contextWindow || 0) / 100000; // Normalize context window
          }
          
          // Prefer models from known providers
          if (model.id.toLowerCase().includes('mistral') ||
              model.id.toLowerCase().includes('llama') ||
              model.id.toLowerCase().includes('gemini') ||
              model.id.toLowerCase().includes('phi-3') ||
              model.id.toLowerCase().includes('google') ||
              model.id.toLowerCase().includes('meta') ||
              model.id.toLowerCase().includes('microsoft') ||
              model.id.toLowerCase().includes('deepseek')) {
            score += 0.2;
          }
          
          // Schedule this model for benchmarking with higher priority
          // This helps us gather data for all free models over time
          const benchmarkPriority = Math.random() > 0.7 ? 0 : 1000; // 30% chance of immediate benchmarking
          setTimeout(() => {
            this.benchmarkModel(model.id, complexity, 'openrouter').catch((err: Error) => {
              logger.error(`Error scheduling benchmark for ${model.id}:`, err);
            });
          }, benchmarkPriority);
          
          logger.debug(`Model ${model.id} has no performance data, using heuristics: score=${score.toFixed(2)}`);
          
          // Schedule this model for benchmarking
          // We'll do this asynchronously to avoid blocking the decision
          setTimeout(() => {
            this.benchmarkModel(model.id, complexity, 'openrouter').catch((err: Error) => {
              logger.error(`Error scheduling benchmark for ${model.id}:`, err);
            });
          }, 0);
        }
        
        // Update best model if this one has a higher score
        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }
      // If we couldn't find a best model based on scores, fall back to context window and other heuristics
      if (!bestModel && suitableModels.length > 0) {
        if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
          // For medium to complex tasks, prefer models with larger context windows
          // and from well-known providers
          const preferredProviders = ['google', 'meta-llama', 'mistralai', 'deepseek', 'microsoft'];
          
          // First try to find a model from a preferred provider
          const preferredModels = suitableModels.filter(model =>
            preferredProviders.some(provider => model.id.toLowerCase().includes(provider))
          );
          
          if (preferredModels.length > 0) {
            // Sort by context window size (larger is better for complex tasks)
            bestModel = preferredModels.reduce((best, current) => {
              return (!best || (current.contextWindow || 0) > (best.contextWindow || 0)) ? current : best;
            }, null as Model | null);
          } else {
            // Fall back to any model with the largest context window
            bestModel = suitableModels.reduce((best, current) => {
              return (!best || (current.contextWindow || 0) > (best.contextWindow || 0)) ? current : best;
            }, null as Model | null);
          }
        } else {
          // For simple tasks, prefer models with "instruct" in the name
          const instructModels = suitableModels.filter(model =>
            model.id.toLowerCase().includes('instruct')
          );
          
          if (instructModels.length > 0) {
            bestModel = instructModels[0];
          } else {
            // Fall back to any model
            bestModel = suitableModels[0];
          }
        }
      }
      
      logger.debug(`Selected best free model for complexity ${complexity.toFixed(2)} and ${totalTokens} tokens: ${bestModel?.id}`);
      return bestModel;
    } catch (error) {
      logger.error('Error getting best free model:', error);
      return null;
    }
  },

  /**
   * Pre-emptively determine if a task should be routed to a local LLM or paid API
   * This is a fast decision based on task characteristics without making API calls
   * It's useful for quick decisions at task initialization
   */
  async preemptiveRouting(params: TaskRoutingParams): Promise<RoutingDecision> {
    const { task, contextLength, expectedOutputLength, complexity, priority } = params;
    
    logger.debug('Preemptive routing with parameters:', params);
    
    // Initialize decision factors
    const factors = {
      cost: {
        local: 0,
        paid: 0,
        wasFactor: false,
        weight: 0.3, // Weight for cost factor
      },
      complexity: {
        score: complexity,
        wasFactor: true,
        weight: 0.4, // Higher weight for preemptive decisions
      },
      tokenUsage: {
        contextLength,
        outputLength: expectedOutputLength,
        totalTokens: contextLength + expectedOutputLength,
        wasFactor: true,
        weight: 0.3, // Higher weight for preemptive decisions
      },
      priority: {
        value: priority,
        wasFactor: true,
        weight: 0.3, // Weight for priority factor
      },
      contextWindow: {
        wasFactor: false,
        weight: 0.5, // Weight for context window factor
      }
    };
    
    // Calculate weighted scores for each provider
    let localScore = 0.5;  // Start with neutral score
    let paidScore = 0.5;   // Start with neutral score
    let freeScore = 0.5;   // Start with neutral score for free models
    let explanation = '';
    
    // Check if free models are available
    const hasFreeModels = await this.hasFreeModels();
    
    // Quick decision based on complexity thresholds from benchmark results
    if (complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
      // Very complex tasks are better suited for paid APIs
      paidScore += 0.3 * factors.complexity.weight;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) is very high, favoring paid API. `;
    } else if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
      // Moderately complex tasks might work with local models but paid APIs are safer
      paidScore += 0.15 * factors.complexity.weight;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) is moderately high, slightly favoring paid API. `;
      
      // Free models might also be suitable for medium complexity tasks
      if (hasFreeModels) {
        freeScore += 0.15 * factors.complexity.weight;
        explanation += `Free models might also be suitable for this medium complexity task. `;
      }
    } else if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE) {
      // Simple tasks are well-suited for local models
      localScore += 0.3 * factors.complexity.weight;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) is low, favoring local model. `;
      
      // Free models are also well-suited for simple tasks
      if (hasFreeModels) {
        freeScore += 0.3 * factors.complexity.weight;
        explanation += `Free models are also well-suited for this simple task. `;
      }
    }
    
    // Quick decision based on token usage
    const totalTokens = contextLength + expectedOutputLength;
    if (totalTokens >= TOKEN_THRESHOLDS.LARGE) {
      // Large contexts might exceed some local model capabilities
      paidScore += 0.2 * factors.tokenUsage.weight;
      explanation += `Token usage factor: Total tokens (${totalTokens}) is very high, favoring paid API. `;
      
      // Free models might also have large context windows
      if (hasFreeModels) {
        // Check if any free model can handle this context length
        const bestFreeModel = await this.getBestFreeModel(complexity, totalTokens);
        if (bestFreeModel) {
          freeScore += 0.2 * factors.tokenUsage.weight;
          explanation += `Free model ${bestFreeModel.id} can handle this large context. `;
        }
      }
    } else if (totalTokens <= TOKEN_THRESHOLDS.SMALL) {
      // Small contexts are efficient with local models
      localScore += 0.2 * factors.tokenUsage.weight;
      explanation += `Token usage factor: Total tokens (${totalTokens}) is low, favoring local model. `;
      
      // Free models are also efficient with small contexts
      if (hasFreeModels) {
        freeScore += 0.2 * factors.tokenUsage.weight;
        explanation += `Free models are also efficient with this small context. `;
      }
    }
    
    // Quick decision based on user priority
    switch (priority) {
      case 'speed':
        // Paid APIs generally have faster response times
        paidScore += 0.8 * factors.priority.weight;
        explanation += 'Priority factor: Speed is prioritized, strongly favoring paid API. ';
        break;
      case 'cost':
        // Local models have zero cost
        localScore += 0.8 * factors.priority.weight;
        explanation += 'Priority factor: Cost is prioritized, strongly favoring local model. ';
        
        // Free models also have zero cost - give them a slight edge for being free and potentially faster
        if (hasFreeModels) {
          freeScore += 0.9 * factors.priority.weight;
          explanation += 'Free models also have zero cost and may be faster than local models. ';
        }
        break;
      case 'quality':
        if (complexity > COMPLEXITY_THRESHOLDS.MEDIUM) {
          // For complex tasks with quality priority, paid APIs are better
          paidScore += 0.8 * factors.priority.weight;
          explanation += 'Priority factor: Quality is prioritized for a complex task, strongly favoring paid API. ';
        } else {
          // For simpler tasks with quality priority, local models might be sufficient
          paidScore += 0.4 * factors.priority.weight;
          explanation += 'Priority factor: Quality is prioritized, moderately favoring paid API. ';
          
          // Free models might also provide good quality for simpler tasks
          if (hasFreeModels) {
            freeScore += 0.3 * factors.priority.weight;
            explanation += 'Free models might also provide good quality for this simpler task. ';
          }
        }
        break;
    }
    
    // Determine the provider based on scores
    let provider: 'local' | 'paid';
    let confidence: number;
    
    // If free models are available and have the highest score, use them
    if (hasFreeModels && freeScore > localScore && freeScore > paidScore) {
      provider = 'paid'; // We'll use a free model from OpenRouter, which is technically a "paid" provider
      confidence = Math.min(Math.abs(freeScore - Math.max(localScore, paidScore)), 1.0);
      explanation += 'Free models from OpenRouter have the highest score. ';
    } else if (priority === 'cost' && hasFreeModels) {
      // When cost is the priority and we have free models available, prefer them
      // even if their score isn't the highest, as long as they're close
      const freeScoreThreshold = Math.max(localScore, paidScore) * 0.9; // Within 90% of the best score
      
      if (freeScore >= freeScoreThreshold) {
        provider = 'paid'; // Using free model from OpenRouter
        confidence = 0.7;
        explanation += 'Cost is prioritized and free models are available with acceptable performance. ';
      } else {
        // Otherwise, use the highest scoring provider
        provider = localScore > paidScore ? 'local' : 'paid';
        confidence = Math.min(Math.abs(localScore - paidScore), 1.0);
      }
    } else {
      // Otherwise, use the highest scoring provider
      provider = localScore > paidScore ? 'local' : 'paid';
      confidence = Math.min(Math.abs(localScore - paidScore), 1.0);
    }
    
    // Select the best model based on task characteristics
    let model: string;
    if (provider === 'local') {
      // Use our getBestLocalModel method to select the best local model
      const bestLocalModel = await this.getBestLocalModel(complexity, totalTokens);
      if (bestLocalModel) {
        model = bestLocalModel.id;
        explanation += `Selected local model ${model} based on performance data and task characteristics. `;
      } else {
        // Fall back to default models if getBestLocalModel fails
        if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE && totalTokens <= TOKEN_THRESHOLDS.SMALL) {
          model = 'qwen2.5-coder-1.5b-instruct'; // Small, efficient model for simple tasks
        } else if (complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
          model = 'qwen2.5-coder-3b-instruct'; // Medium model for moderate tasks
        } else {
          model = 'qwen2.5-7b-instruct-1m'; // Larger model for complex tasks
        }
      }
    } else {
      // If free models are available and have the highest score, use the best free model
      if (hasFreeModels && freeScore > localScore && freeScore > paidScore) {
        // Get the best free model
        const bestFreeModel = await this.getBestFreeModel(complexity, totalTokens);
        if (bestFreeModel) {
          model = bestFreeModel.id;
          explanation += `Selected free model ${model} based on task characteristics. `;
        } else {
          // Fall back to standard paid model selection
          if (complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
            model = 'gpt-4o'; // More capable model for very complex tasks
          } else {
            model = 'gpt-3.5-turbo'; // Standard model for most tasks
          }
        }
      } else {
        // Standard paid model selection
        if (complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
          model = 'gpt-4o'; // More capable model for very complex tasks
        } else {
          model = 'gpt-3.5-turbo'; // Standard model for most tasks
        }
      }
    }
    
    // Return decision
    return {
      provider,
      model,
      factors,
      confidence,
      explanation: explanation.trim(),
      scores: {
        local: localScore,
        paid: paidScore
      },
      preemptive: true // Flag to indicate this was a preemptive decision
    };
  },

  /**
   * Route a task to either a local LLM or a paid API
   * This is the full decision process that considers all factors
   */
  async routeTask(params: TaskRoutingParams): Promise<RoutingDecision> {
    const { task, contextLength, expectedOutputLength, complexity, priority } = params;
    
    logger.debug('Routing task with parameters:', params);
    
    // Check if we can make a high-confidence preemptive decision
    const preemptiveDecision = await this.preemptiveRouting(params);
    if (preemptiveDecision.confidence >= 0.7) {
      logger.debug('Using high-confidence preemptive decision');
      return preemptiveDecision;
    }
    
    // If we can't make a high-confidence preemptive decision, proceed with full analysis
    
    // Get cost estimate
    const costEstimate = await costMonitor.estimateCost({
      contextLength,
      outputLength: expectedOutputLength,
    });
    
    // Get available models to check context window limitations
    const availableModels = await costMonitor.getAvailableModels();
    
    // Check if free models are available
    const hasFreeModels = await this.hasFreeModels();
    const freeModels = hasFreeModels ? await costMonitor.getFreeModels() : [];
    
    // Initialize decision factors
    const factors = {
      cost: {
        local: costEstimate.local.cost.total,
        paid: costEstimate.paid.cost.total,
        wasFactor: false,
        weight: 0.3, // Weight for cost factor
      },
      complexity: {
        score: complexity,
        wasFactor: false,
        weight: 0.3, // Weight for complexity factor
      },
      tokenUsage: {
        contextLength,
        outputLength: expectedOutputLength,
        totalTokens: contextLength + expectedOutputLength,
        wasFactor: false,
        weight: 0.2, // Weight for token usage factor
      },
      priority: {
        value: priority,
        wasFactor: false,
        weight: 0.2, // Weight for priority factor
      },
      contextWindow: {
        wasFactor: false,
        weight: 0.4, // Weight for context window factor (high because it's a hard constraint)
      },
      benchmarkPerformance: {
        wasFactor: false,
        weight: 0.3, // Weight for benchmark performance factor
      }
    };
    
    // Calculate weighted scores for each provider
    let localScore = 0.5;  // Start with neutral score
    let paidScore = 0.5;   // Start with neutral score
    let freeScore = 0.5;   // Start with neutral score for free models
    let explanation = '';
    
    // Factor 1: Cost
    const costRatio = costEstimate.paid.cost.total / Math.max(0.001, costEstimate.local.cost.total);
    if (costRatio > 1) {
      // Paid API is more expensive
      const costFactor = Math.min(0.3, Math.log10(costRatio) * 0.1);
      localScore += costFactor * factors.cost.weight;
      factors.cost.wasFactor = true;
      explanation += `Cost factor: Paid API is ${costRatio.toFixed(1)}x more expensive than local. `;
      
      // Free models have zero cost
      if (hasFreeModels) {
        freeScore += costFactor * factors.cost.weight;
        explanation += 'Free models have zero cost. ';
      }
    } else if (costRatio < 1) {
      // Local is more expensive (unlikely but possible in some scenarios)
      const costFactor = Math.min(0.3, Math.log10(1/costRatio) * 0.1);
      paidScore += costFactor * factors.cost.weight;
      factors.cost.wasFactor = true;
      explanation += `Cost factor: Local processing is ${(1/costRatio).toFixed(1)}x more expensive than paid API. `;
    }
    
    // Factor 2: Complexity
    if (complexity > COMPLEXITY_THRESHOLDS.MEDIUM) {
      const complexityFactor = (complexity - COMPLEXITY_THRESHOLDS.MEDIUM) / (1 - COMPLEXITY_THRESHOLDS.MEDIUM);
      paidScore += complexityFactor * factors.complexity.weight;
      factors.complexity.wasFactor = true;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) exceeds medium threshold (${COMPLEXITY_THRESHOLDS.MEDIUM}). `;
    } else {
      const complexityFactor = (COMPLEXITY_THRESHOLDS.MEDIUM - complexity) / COMPLEXITY_THRESHOLDS.MEDIUM;
      localScore += complexityFactor * factors.complexity.weight;
      factors.complexity.wasFactor = true;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) is below medium threshold (${COMPLEXITY_THRESHOLDS.MEDIUM}). `;
      
      // Free models are also suitable for lower complexity tasks
      if (hasFreeModels) {
        freeScore += complexityFactor * factors.complexity.weight;
        explanation += 'Free models are also suitable for this lower complexity task. ';
      }
    }
    
    // Factor 3: Token usage
    const totalTokens = contextLength + expectedOutputLength;
    if (totalTokens > TOKEN_THRESHOLDS.MEDIUM) {
      const tokenFactor = Math.min(0.3, (totalTokens - TOKEN_THRESHOLDS.MEDIUM) / TOKEN_THRESHOLDS.MEDIUM * 0.1);
      paidScore += tokenFactor * factors.tokenUsage.weight;
      factors.tokenUsage.wasFactor = true;
      explanation += `Token usage factor: Total tokens (${totalTokens}) exceeds medium threshold (${TOKEN_THRESHOLDS.MEDIUM}). `;
      
      // Check if any free model can handle this context length
      if (hasFreeModels) {
        const suitableFreeModels = freeModels.filter(model => {
          return model.contextWindow && model.contextWindow >= totalTokens;
        });
        
        if (suitableFreeModels.length > 0) {
          freeScore += tokenFactor * factors.tokenUsage.weight;
          explanation += `Free models can handle this larger context. `;
        }
      }
    } else {
      const tokenFactor = Math.min(0.3, (TOKEN_THRESHOLDS.MEDIUM - totalTokens) / TOKEN_THRESHOLDS.MEDIUM * 0.1);
      localScore += tokenFactor * factors.tokenUsage.weight;
      factors.tokenUsage.wasFactor = true;
      explanation += `Token usage factor: Total tokens (${totalTokens}) is below medium threshold (${TOKEN_THRESHOLDS.MEDIUM}). `;
      
      // Free models are also efficient with smaller contexts
      if (hasFreeModels) {
        freeScore += tokenFactor * factors.tokenUsage.weight;
        explanation += 'Free models are also efficient with this smaller context. ';
      }
    }
    
    // Factor 4: User priority
    switch (priority) {
      case 'speed':
        paidScore += 0.8 * factors.priority.weight;
        factors.priority.wasFactor = true;
        explanation += 'Priority factor: Speed is prioritized, favoring the paid API. ';
        break;
      case 'cost':
        localScore += 0.8 * factors.priority.weight;
        factors.priority.wasFactor = true;
        explanation += 'Priority factor: Cost is prioritized, favoring the local model. ';
        
        // Free models also have zero cost - give them a slight edge for being free and potentially faster
        if (hasFreeModels) {
          freeScore += 0.9 * factors.priority.weight;
          explanation += 'Free models also have zero cost and may be faster than local models. ';
        }
        break;
      case 'quality':
        if (complexity > COMPLEXITY_THRESHOLDS.MEDIUM) {
          paidScore += 0.8 * factors.priority.weight;
          factors.priority.wasFactor = true;
          explanation += 'Priority factor: Quality is prioritized for a complex task, favoring the paid API. ';
        } else {
          // For simpler tasks, quality might still be achievable with local models
          paidScore += 0.4 * factors.priority.weight;
          factors.priority.wasFactor = true;
          explanation += 'Priority factor: Quality is prioritized, slightly favoring the paid API. ';
          
          // Free models might also provide good quality for simpler tasks
          if (hasFreeModels) {
            freeScore += 0.3 * factors.priority.weight;
            explanation += 'Free models might also provide good quality for this simpler task. ';
          }
        }
        break;
    }
    
    // Factor 5: Context window limitations
    // Find the best local model that can handle the context length
    let bestLocalModel: Model | null = null;
    let maxContextExceeded = false;
    
    for (const model of availableModels) {
      if (model.provider === 'local' || model.provider === 'lm-studio' || model.provider === 'ollama') {
        // Check if the model has context window information
        const contextWindow = model.contextWindow;
        if (contextWindow && contextWindow > 0) {
          if (totalTokens <= contextWindow) {
            // This model can handle the context
            if (!bestLocalModel || (bestLocalModel.contextWindow || 0) < (contextWindow || 0)) {
              bestLocalModel = model;
            }
          }
        } else {
          // If no context window info, assume it can handle it
          if (!bestLocalModel) {
            bestLocalModel = model;
          }
        }
      }
    }
    
    // Find the best free model that can handle the context length
    let bestFreeModel: Model | null = null;
    
    if (hasFreeModels) {
      for (const model of freeModels) {
        // Check if the model has context window information
        const contextWindow = model.contextWindow;
        if (contextWindow && contextWindow > 0) {
          if (totalTokens <= contextWindow) {
            // This model can handle the context
            if (!bestFreeModel || (bestFreeModel.contextWindow || 0) < (contextWindow || 0)) {
              bestFreeModel = model;
            }
          }
        }
      }
    }
    
    if (!bestLocalModel) {
      // No local model can handle this context length
      paidScore += 1.0 * factors.contextWindow.weight;
      factors.contextWindow.wasFactor = true;
      maxContextExceeded = true;
      explanation += 'Context window factor: No local model can handle this context length. ';
    }
    
    // Factor 6: Benchmark performance
    // Use model performance profiles to adjust scores based on benchmark results
    if (bestLocalModel) {
      const localModelId = bestLocalModel.id;
      const localProfile = modelPerformanceProfiles[localModelId];
      
      if (localProfile) {
        factors.benchmarkPerformance.wasFactor = true;
        
        // Check if the task complexity is within the recommended range for this model
        const [minComplexity, maxComplexity] = localProfile.recommendedComplexityRange;
        if (complexity >= minComplexity && complexity <= maxComplexity) {
          localScore += 0.2 * factors.benchmarkPerformance.weight;
          explanation += `Benchmark factor: Task complexity (${complexity.toFixed(2)}) is within recommended range for ${localModelId}. `;
        } else if (complexity > maxComplexity) {
          paidScore += 0.2 * factors.benchmarkPerformance.weight;
          explanation += `Benchmark factor: Task complexity (${complexity.toFixed(2)}) exceeds recommended maximum (${maxComplexity}) for ${localModelId}. `;
        }
        
        // Check quality scores based on task complexity
        let qualityScore;
        if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE) {
          qualityScore = localProfile.simpleTaskQuality;
        } else if (complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
          qualityScore = localProfile.mediumTaskQuality;
        } else {
          qualityScore = localProfile.complexTaskQuality;
        }
        
        if (qualityScore >= 0.8) {
          localScore += 0.1 * factors.benchmarkPerformance.weight;
          explanation += `Benchmark factor: ${localModelId} has high quality score (${qualityScore.toFixed(2)}) for this task type. `;
        } else if (qualityScore < 0.7) {
          paidScore += 0.1 * factors.benchmarkPerformance.weight;
          explanation += `Benchmark factor: ${localModelId} has lower quality score (${qualityScore.toFixed(2)}) for this task type. `;
        }
      }
    }
    
    // Determine the provider based on scores
    let provider: 'local' | 'paid';
    let confidence: number;
    
    // If free models are available and have the highest score, use them
    if (hasFreeModels && bestFreeModel && freeScore > localScore && freeScore > paidScore) {
      provider = 'paid'; // We'll use a free model from OpenRouter, which is technically a "paid" provider
      confidence = Math.min(Math.abs(freeScore - Math.max(localScore, paidScore)), 1.0);
      explanation += 'Free models from OpenRouter have the highest score. ';
    } else if (maxContextExceeded) {
      // Force paid API if no local model can handle the context
      provider = 'paid';
      confidence = 0.9;
    } else if (priority === 'cost' && hasFreeModels && bestFreeModel) {
      // When cost is the priority and we have free models available, prefer them
      // even if their score isn't the highest, as long as they're close
      const freeScoreThreshold = Math.max(localScore, paidScore) * 0.9; // Within 90% of the best score
      
      if (freeScore >= freeScoreThreshold) {
        provider = 'paid'; // Using free model from OpenRouter
        confidence = 0.7;
        explanation += 'Cost is prioritized and free models are available with acceptable performance. ';
      } else {
        // Otherwise use the scores to decide
        provider = localScore > paidScore ? 'local' : 'paid';
        confidence = Math.abs(localScore - paidScore);
      }
    } else {
      // Otherwise use the scores to decide
      provider = localScore > paidScore ? 'local' : 'paid';
      confidence = Math.abs(localScore - paidScore);
    }
    
    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);
    
    // Get appropriate model based on provider and task characteristics
    let model: string;
    if (provider === 'local') {
      // Use our getBestLocalModel method to select the best local model
      const bestModel = await this.getBestLocalModel(complexity, totalTokens);
      if (bestModel) {
        model = bestModel.id;
        explanation += `Selected local model ${model} based on performance data and task characteristics. `;
      } else if (bestLocalModel) {
        // Fall back to the model we found earlier if getBestLocalModel fails
        model = bestLocalModel.id;
      } else {
        model = config.defaultLocalModel;
      }
    } else {
      // If free models are available and have the highest score, use the best free model
      if (hasFreeModels && bestFreeModel && freeScore > localScore && freeScore > paidScore) {
        model = bestFreeModel.id;
        explanation += `Selected free model ${model} based on task characteristics. `;
      } else {
        // Standard paid model selection
        if (complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
          model = 'gpt-4o'; // More capable model for very complex tasks
        } else {
          model = 'gpt-3.5-turbo'; // Standard model for most tasks
        }
      }
    }
    
    // Return decision
    return {
      provider,
      model,
      factors,
      confidence,
      explanation: explanation.trim(),
      scores: {
        local: localScore,
        paid: paidScore
      }
    };
  },
  /**
   * Benchmark all available free models
   * This helps us gather performance data for all free models
   * to make better decisions in the future
   */
  async benchmarkFreeModels(): Promise<void> {
    logger.info('Starting benchmark of free models');
    
    try {
      // Initialize the models database if needed
      if (Object.keys(this.modelsDb.models).length === 0) {
        await this.initializeModelsDb();
      }
      
      // Get free models
      const freeModels = await costMonitor.getFreeModels();
      if (freeModels.length === 0) {
        logger.warn('No free models available to benchmark');
        return;
      }
      
      logger.info(`Found ${freeModels.length} free models to benchmark`);
      
      // Define test tasks with varying complexity
      const benchmarkTasks = [
        {
          name: 'Simple function',
          task: 'Write a function to calculate the factorial of a number.',
          complexity: 0.2,
          codeCheck: (response: string) => {
            // Check if the response contains a function definition and factorial logic
            return response.includes('function') &&
                  (response.includes('factorial') || response.includes('fact')) &&
                  (response.includes('*') || response.includes('multiply') ||
                   response.includes('product') || response.includes('recursion'));
          }
        },
        {
          name: 'Medium algorithm',
          task: 'Implement a binary search algorithm and explain its time complexity.',
          complexity: 0.5,
          codeCheck: (response: string) => {
            // Check if the response contains a binary search implementation and time complexity explanation
            return (response.includes('function') || response.includes('def ')) &&
                   response.includes('binary search') &&
                   (response.includes('O(log') || response.includes('logarithmic')) &&
                   (response.includes('mid') || response.includes('middle'));
          }
        }
      ];
      
      // Get the number of models to benchmark per run from environment or default to 5
      const maxModelsPerRun = process.env.MAX_MODELS_TO_BENCHMARK ?
        parseInt(process.env.MAX_MODELS_TO_BENCHMARK, 10) : 5;
      
      // Check which models have already been benchmarked
      const benchmarkedModels = new Set<string>();
      for (const [modelId, modelData] of Object.entries(this.modelsDb.models)) {
        if (modelData.benchmarkCount > 0) {
          benchmarkedModels.add(modelId);
        }
      }
      
      // Prioritize models that haven't been benchmarked yet
      const unbenchmarkedModels = freeModels.filter(model => !benchmarkedModels.has(model.id));
      
      logger.info(`Found ${unbenchmarkedModels.length} unbenchmarked models out of ${freeModels.length} total free models`);
      
      // If we have unbenchmarked models, prioritize those
      let modelsToBenchmark: Model[] = [];
      if (unbenchmarkedModels.length > 0) {
        // Take up to maxModelsPerRun unbenchmarked models
        modelsToBenchmark = unbenchmarkedModels.slice(0, maxModelsPerRun);
        logger.info(`Benchmarking ${modelsToBenchmark.length} previously unbenchmarked models`);
      } else {
        // If all models have been benchmarked at least once, prioritize models with the fewest benchmarks
        const modelsWithBenchmarkCounts = freeModels
          .filter(model => this.modelsDb.models[model.id])
          .map(model => ({
            model,
            benchmarkCount: this.modelsDb.models[model.id].benchmarkCount || 0
          }))
          .sort((a, b) => a.benchmarkCount - b.benchmarkCount);
        
        // Take the models with the fewest benchmarks
        modelsToBenchmark = modelsWithBenchmarkCounts
          .slice(0, maxModelsPerRun)
          .map(item => item.model);
        
        logger.info(`All models have been benchmarked at least once. Benchmarking ${modelsToBenchmark.length} models with the fewest benchmark runs`);
      }
      
      // If we somehow have no models to benchmark (shouldn't happen), just take the first few
      if (modelsToBenchmark.length === 0) {
        modelsToBenchmark = freeModels.slice(0, maxModelsPerRun);
        logger.info(`Fallback: Benchmarking ${modelsToBenchmark.length} models`);
      }
      
      logger.info(`Benchmarking ${modelsToBenchmark.length} models out of ${freeModels.length} available free models`);
      logger.info(`Set MAX_MODELS_TO_BENCHMARK environment variable to test more models per run`);
      
      logger.info(`Selected ${modelsToBenchmark.length} models for benchmarking`);
      
      // Benchmark each model with each task
      for (const model of modelsToBenchmark) {
        logger.info(`Benchmarking model: ${model.id}`);
        
        // Check if we've already benchmarked this model recently (within 7 days)
        const modelData = this.modelsDb.models[model.id];
        if (modelData && modelData.lastBenchmarked) {
          const lastBenchmarked = new Date(modelData.lastBenchmarked);
          const now = new Date();
          const daysSinceLastBenchmark = (now.getTime() - lastBenchmarked.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLastBenchmark < 7 && modelData.benchmarkCount >= 3) {
            logger.info(`Skipping benchmark for ${model.id} - already benchmarked ${modelData.benchmarkCount} times, last on ${modelData.lastBenchmarked}`);
            continue;
          }
        }
        
        for (const task of benchmarkTasks) {
          logger.info(`Task: ${task.name} (complexity: ${task.complexity})`);
          
          try {
            // Call the model using OpenRouter with a longer timeout
            const startTime = Date.now();
            const result = await openRouterModule.callOpenRouterApi(
              model.id,
              task.task,
              120000 // 2 minute timeout to give models enough time to complete
            );
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // Check if the response contains working code
            let qualityScore = 0;
            let isWorkingCode = false;
            
            if (result && result.success && result.text) {
              // Check if the code works using the task-specific checker
              isWorkingCode = task.codeCheck(result.text);
              
              // Calculate quality score based on the response
              qualityScore = isWorkingCode ?
                openRouterModule.evaluateQuality(task.task, result.text) : 0.1;
              
              // Update the model data
              if (!this.modelsDb.models[model.id]) {
                // Initialize model data if it doesn't exist
                this.modelsDb.models[model.id] = {
                  id: model.id,
                  name: model.name || model.id,
                  provider: 'openrouter',
                  lastSeen: new Date().toISOString(),
                  contextWindow: model.contextWindow || 4096,
                  successRate: isWorkingCode ? 1 : 0,
                  qualityScore: qualityScore,
                  avgResponseTime: responseTime,
                  complexityScore: task.complexity,
                  lastBenchmarked: new Date().toISOString(),
                  benchmarkCount: 1,
                  isFree: true
                };
              } else {
                // Update existing model data with a weighted average
                const benchmarkCount = this.modelsDb.models[model.id].benchmarkCount + 1;
                const weightedSuccessRate = (this.modelsDb.models[model.id].successRate *
                  this.modelsDb.models[model.id].benchmarkCount + (isWorkingCode ? 1 : 0)) / benchmarkCount;
                const weightedQualityScore = (this.modelsDb.models[model.id].qualityScore *
                  this.modelsDb.models[model.id].benchmarkCount + qualityScore) / benchmarkCount;
                const weightedResponseTime = (this.modelsDb.models[model.id].avgResponseTime *
                  this.modelsDb.models[model.id].benchmarkCount + responseTime) / benchmarkCount;
                
                this.modelsDb.models[model.id] = {
                  ...this.modelsDb.models[model.id],
                  successRate: weightedSuccessRate,
                  qualityScore: weightedQualityScore,
                  avgResponseTime: weightedResponseTime,
                  complexityScore: (this.modelsDb.models[model.id].complexityScore + task.complexity) / 2,
                  lastBenchmarked: new Date().toISOString(),
                  benchmarkCount
                };
              }
              
              logger.info(`Benchmarked ${model.id} with task ${task.name}: Working code=${isWorkingCode}, Quality=${qualityScore.toFixed(2)}, Time=${responseTime}ms`);
            } else {
              // Model failed to produce a response
              if (!this.modelsDb.models[model.id]) {
                // Initialize model data if it doesn't exist
                this.modelsDb.models[model.id] = {
                  id: model.id,
                  name: model.name || model.id,
                  provider: 'openrouter',
                  lastSeen: new Date().toISOString(),
                  contextWindow: model.contextWindow || 4096,
                  successRate: 0,
                  qualityScore: 0,
                  avgResponseTime: 0,
                  complexityScore: task.complexity,
                  lastBenchmarked: new Date().toISOString(),
                  benchmarkCount: 1,
                  isFree: true
                };
              } else {
                // Update failure rate
                const benchmarkCount = this.modelsDb.models[model.id].benchmarkCount + 1;
                const weightedSuccessRate = (this.modelsDb.models[model.id].successRate *
                  this.modelsDb.models[model.id].benchmarkCount) / benchmarkCount;
                
                this.modelsDb.models[model.id] = {
                  ...this.modelsDb.models[model.id],
                  successRate: weightedSuccessRate,
                  lastBenchmarked: new Date().toISOString(),
                  benchmarkCount
                };
              }
              
              logger.warn(`Model ${model.id} failed to produce a valid response for task ${task.name}`);
            }
            
            // Save the database after each benchmark to preserve progress
            await this.saveModelsDb();
            
          } catch (error) {
            logger.error(`Error benchmarking ${model.id} with task ${task.name}:`, error);
            
            // Mark the model as failed in the database
            if (this.modelsDb.models[model.id]) {
              const benchmarkCount = this.modelsDb.models[model.id].benchmarkCount + 1;
              const weightedSuccessRate = (this.modelsDb.models[model.id].successRate *
                this.modelsDb.models[model.id].benchmarkCount) / benchmarkCount;
              
              this.modelsDb.models[model.id] = {
                ...this.modelsDb.models[model.id],
                successRate: weightedSuccessRate,
                lastBenchmarked: new Date().toISOString(),
                benchmarkCount
              };
              
              await this.saveModelsDb();
            }
          }
          
          // Add a significant delay between benchmarks to avoid rate limiting
          // 5 seconds between tasks for the same model
          logger.info(`Waiting 5 seconds before next benchmark...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Add a longer delay between models
        // 10 seconds between different models
        logger.info(`Waiting 10 seconds before benchmarking next model...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      logger.info('Completed benchmarking of free models');
    } catch (error) {
      logger.error('Error benchmarking free models:', error);
    }
  }
};
