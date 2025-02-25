import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { logger } from '../../utils/logger.js';
import { Model, RoutingDecision, TaskRoutingParams } from '../../types/index.js';

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
 */
export const decisionEngine = {
  /**
   * Route a task to either a local LLM or a paid API
   */
  async routeTask(params: TaskRoutingParams): Promise<RoutingDecision> {
    const { task, contextLength, expectedOutputLength, complexity, priority } = params;
    
    logger.debug('Routing task with parameters:', params);
    
    // Get cost estimate
    const costEstimate = await costMonitor.estimateCost({
      contextLength,
      outputLength: expectedOutputLength,
    });
    
    // Get available models to check context window limitations
    const availableModels = await costMonitor.getAvailableModels();
    
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
      }
    };
    
    // Calculate weighted scores for each provider
    let localScore = 0.5;  // Start with neutral score
    let paidScore = 0.5;   // Start with neutral score
    let explanation = '';
    
    // Factor 1: Cost
    const costRatio = costEstimate.paid.cost.total / Math.max(0.001, costEstimate.local.cost.total);
    if (costRatio > 1) {
      // Paid API is more expensive
      const costFactor = Math.min(0.3, Math.log10(costRatio) * 0.1);
      localScore += costFactor * factors.cost.weight;
      factors.cost.wasFactor = true;
      explanation += `Cost factor: Paid API is ${costRatio.toFixed(1)}x more expensive than local. `;
    } else if (costRatio < 1) {
      // Local is more expensive (unlikely but possible in some scenarios)
      const costFactor = Math.min(0.3, Math.log10(1/costRatio) * 0.1);
      paidScore += costFactor * factors.cost.weight;
      factors.cost.wasFactor = true;
      explanation += `Cost factor: Local processing is ${(1/costRatio).toFixed(1)}x more expensive than paid API. `;
    }
    
    // Factor 2: Complexity
    if (complexity > config.qualityThreshold) {
      const complexityFactor = (complexity - config.qualityThreshold) / (1 - config.qualityThreshold);
      paidScore += complexityFactor * factors.complexity.weight;
      factors.complexity.wasFactor = true;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) exceeds quality threshold (${config.qualityThreshold}). `;
    } else {
      const complexityFactor = (config.qualityThreshold - complexity) / config.qualityThreshold;
      localScore += complexityFactor * factors.complexity.weight;
      factors.complexity.wasFactor = true;
      explanation += `Complexity factor: Task complexity (${complexity.toFixed(2)}) is below quality threshold (${config.qualityThreshold}). `;
    }
    
    // Factor 3: Token usage
    const totalTokens = contextLength + expectedOutputLength;
    if (totalTokens > config.tokenThreshold) {
      const tokenFactor = Math.min(0.3, (totalTokens - config.tokenThreshold) / config.tokenThreshold * 0.1);
      localScore += tokenFactor * factors.tokenUsage.weight;
      factors.tokenUsage.wasFactor = true;
      explanation += `Token usage factor: Total tokens (${totalTokens}) exceeds threshold (${config.tokenThreshold}). `;
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
        break;
      case 'quality':
        if (complexity > 0.5) {
          paidScore += 0.8 * factors.priority.weight;
          factors.priority.wasFactor = true;
          explanation += 'Priority factor: Quality is prioritized for a complex task, favoring the paid API. ';
        } else {
          // For simpler tasks, quality might still be achievable with local models
          paidScore += 0.4 * factors.priority.weight;
          factors.priority.wasFactor = true;
          explanation += 'Priority factor: Quality is prioritized, slightly favoring the paid API. ';
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
        const contextWindow = (model as any).contextWindow;
        if (contextWindow && contextWindow > 0) {
          if (totalTokens <= contextWindow) {
            // This model can handle the context
            if (!bestLocalModel || (bestLocalModel as any).contextWindow < contextWindow) {
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
    
    if (!bestLocalModel) {
      // No local model can handle this context length
      paidScore += 1.0 * factors.contextWindow.weight;
      factors.contextWindow.wasFactor = true;
      maxContextExceeded = true;
      explanation += 'Context window factor: No local model can handle this context length. ';
    }
    
    // Determine the provider based on scores
    let provider: 'local' | 'paid';
    let confidence: number;
    
    if (maxContextExceeded) {
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
    
    // Get appropriate model based on provider
    let model: string;
    if (provider === 'local') {
      model = bestLocalModel ? bestLocalModel.id : config.defaultLocalModel;
    } else {
      model = 'gpt-3.5-turbo';
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