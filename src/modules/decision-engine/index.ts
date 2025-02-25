import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { logger } from '../../utils/logger.js';
import { RoutingDecision, TaskRoutingParams } from '../../types/index.js';

/**
 * Decision Engine
 * 
 * This module is responsible for making decisions about routing tasks
 * between local LLMs and paid APIs based on various factors:
 * - Cost
 * - Task complexity
 * - Token usage
 * - User priority
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
    
    // Initialize decision factors
    const factors = {
      cost: {
        local: costEstimate.local.cost.total,
        paid: costEstimate.paid.cost.total,
        wasFactor: false,
      },
      complexity: {
        score: complexity,
        wasFactor: false,
      },
      tokenUsage: {
        contextLength,
        outputLength: expectedOutputLength,
        wasFactor: false,
      },
      priority: {
        value: priority,
        wasFactor: false,
      },
    };
    
    // Make decision based on factors
    let provider: 'local' | 'paid' = 'paid';
    let confidence = 0.5;
    let explanation = '';
    
    // Factor 1: Cost
    if (costEstimate.paid.cost.total > config.costThreshold) {
      provider = 'local';
      factors.cost.wasFactor = true;
      confidence += 0.1;
      explanation += 'The cost of using a paid API exceeds the threshold. ';
    }
    
    // Factor 2: Complexity
    if (complexity > config.qualityThreshold) {
      provider = 'paid';
      factors.complexity.wasFactor = true;
      confidence += 0.2;
      explanation += 'The task is complex and requires a more capable model. ';
    } else if (complexity < 0.3) {
      provider = 'local';
      factors.complexity.wasFactor = true;
      confidence += 0.1;
      explanation += 'The task is simple and can be handled by a local model. ';
    }
    
    // Factor 3: Token usage
    if (contextLength + expectedOutputLength > config.tokenThreshold) {
      provider = 'local';
      factors.tokenUsage.wasFactor = true;
      confidence += 0.1;
      explanation += 'The token usage is high, making it more cost-effective to use a local model. ';
    }
    
    // Factor 4: User priority
    switch (priority) {
      case 'speed':
        provider = 'paid';
        factors.priority.wasFactor = true;
        confidence += 0.2;
        explanation += 'Speed is prioritized, favoring the paid API. ';
        break;
      case 'cost':
        provider = 'local';
        factors.priority.wasFactor = true;
        confidence += 0.2;
        explanation += 'Cost is prioritized, favoring the local model. ';
        break;
      case 'quality':
        if (complexity > 0.5) {
          provider = 'paid';
          factors.priority.wasFactor = true;
          confidence += 0.2;
          explanation += 'Quality is prioritized for a complex task, favoring the paid API. ';
        }
        break;
    }
    
    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);
    
    // Get appropriate model based on provider
    const model = provider === 'local' ? config.defaultLocalModel : 'gpt-3.5-turbo';
    
    // Return decision
    return {
      provider,
      model,
      factors,
      confidence,
      explanation: explanation.trim(),
    };
  },
};