import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { openRouterModule } from '../openrouter/index.js';
import { logger } from '../../utils/logger.js';
import { Model, RoutingDecision, TaskRoutingParams, ModelPerformanceProfile } from '../../types/index.js';
import fs from 'fs/promises';
import path from 'path';

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
  /**
   * Get model performance profiles
   * This allows external modules to access the performance profiles
   */
  getModelPerformanceProfiles(): Record<string, ModelPerformanceProfile> {
    return modelPerformanceProfiles;
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
      
      // Find the best model based on complexity
      let bestModel: Model | null = null;
      
      if (complexity >= COMPLEXITY_THRESHOLDS.COMPLEX) {
        // For complex tasks, prefer models with larger context windows
        bestModel = suitableModels.reduce((best, current) => {
          return (!best || (current.contextWindow || 0) > (best.contextWindow || 0)) ? current : best;
        }, null as Model | null);
      } else if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
        // For medium complexity tasks, prefer a balance of context window and response time
        // Since we don't have response time data for all models, use context window as a proxy
        bestModel = suitableModels.reduce((best, current) => {
          return (!best || (current.contextWindow || 0) > (best.contextWindow || 0)) ? current : best;
        }, null as Model | null);
      } else {
        // For simple tasks, any model will do
        bestModel = suitableModels[0];
      }
      
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
        
        // Free models also have zero cost
        if (hasFreeModels) {
          freeScore += 0.8 * factors.priority.weight;
          explanation += 'Free models also have zero cost. ';
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
    } else {
      // Otherwise, use the highest scoring provider
      provider = localScore > paidScore ? 'local' : 'paid';
      confidence = Math.min(Math.abs(localScore - paidScore), 1.0);
    }
    
    // Select the best model based on task characteristics
    let model: string;
    if (provider === 'local') {
      // Select local model based on complexity and token usage
      if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE && totalTokens <= TOKEN_THRESHOLDS.SMALL) {
        model = 'qwen2.5-coder-1.5b-instruct'; // Small, efficient model for simple tasks
      } else if (complexity <= COMPLEXITY_THRESHOLDS.MEDIUM) {
        model = 'qwen2.5-coder-3b-instruct'; // Medium model for moderate tasks
      } else {
        model = 'qwen2.5-7b-instruct-1m'; // Larger model for complex tasks
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
        
        // Free models also have zero cost
        if (hasFreeModels) {
          freeScore += 0.8 * factors.priority.weight;
          explanation += 'Free models also have zero cost. ';
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
      if (bestLocalModel) {
        model = bestLocalModel.id;
        
        // If we have multiple suitable models, select based on task complexity
        if (complexity <= COMPLEXITY_THRESHOLDS.SIMPLE && totalTokens <= TOKEN_THRESHOLDS.SMALL) {
          // For simple tasks with small context, prefer smaller models
          const smallModels = availableModels.filter(m =>
            (m.provider === 'local' || m.provider === 'lm-studio' || m.provider === 'ollama') &&
            (m.id.includes('1.5b') || m.id.includes('3b') || m.id.includes('mini'))
          );
          if (smallModels.length > 0) {
            model = smallModels[0].id;
          }
        } else if (complexity >= COMPLEXITY_THRESHOLDS.MEDIUM) {
          // For more complex tasks, prefer larger models
          const largerModels = availableModels.filter(m =>
            (m.provider === 'local' || m.provider === 'lm-studio' || m.provider === 'ollama') &&
            (m.id.includes('7b') || m.id.includes('13b') || m.id.includes('70b'))
          );
          if (largerModels.length > 0) {
            model = largerModels[0].id;
          }
        }
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
};
