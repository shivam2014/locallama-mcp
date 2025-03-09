import { config } from '../../config/index.js';
import { costMonitor } from '../cost-monitor/index.js';
import { logger } from '../../utils/logger.js';
import { Model, RoutingDecision, TaskRoutingParams, ModelPerformanceProfile } from '../../types/index.js';
import { modelProfiles } from './utils/modelProfiles.js';
import { modelSelector } from './services/modelSelector.js';
import { codeEvaluationService } from './services/codeEvaluationService.js';
import { benchmarkService } from './services/benchmarkService.js';
import { modelsDbService } from './services/modelsDb.js';
import { taskVerificationService } from './services/taskVerificationService.js';
import { COMPLEXITY_THRESHOLDS, TOKEN_THRESHOLDS } from './types/index.js';

/**
 * Decision Engine
 *
 * This module is responsible for making decisions about routing tasks
 * between local LLMs and paid APIs based on various factors including:
 * - Cost
 * - Task complexity
 * - Token usage
 * - User priority
 * - Model context window limitations
 * - Benchmark performance data
 * - Availability of free models
 * - Previous task attempts and verification results
 */
export const decisionEngine = {
  /**
   * Initialize the decision engine
   */
  async initialize(): Promise<void> {
    logger.info('Initializing decision engine');
    
    try {
      await modelsDbService.initialize();
      
      if (config.openRouterApiKey) {
        try {
          setTimeout(() => {
            benchmarkService.benchmarkFreeModels().catch(err => {
              logger.error('Error benchmarking free models:', err);
            });
          }, 5000);
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
   * Pre-emptively determine if a task should be routed to a local LLM or paid API
   */
  async preemptiveRouting(params: TaskRoutingParams): Promise<RoutingDecision> {
    // ... (preemptive routing implementation remains unchanged)
  },

  /**
   * Route a task to either a local LLM or a paid API
   * Now includes verification workflow and retry logic
   */
  async routeTask(params: TaskRoutingParams): Promise<RoutingDecision> {
    const { task, contextLength, expectedOutputLength, complexity, priority } = params;
    
    logger.debug('Routing task with parameters:', params);
    
    // Check previous attempts
    const taskHistory = taskVerificationService.getAttempts(task);
    
    // If we've failed twice with local models, force paid API
    if (taskHistory.failureCount >= 2) {
      logger.info(`Task "${task}" has failed ${taskHistory.failureCount} times with local models, forcing paid API`);
      const paidDecision = await this.forcePaidApiRouting(params);
      return paidDecision;
    }
    
    // Check if we can make a high-confidence preemptive decision
    const preemptiveDecision = await this.preemptiveRouting(params);
    if (preemptiveDecision.confidence >= 0.7) {
      logger.debug('Using high-confidence preemptive decision');
      return preemptiveDecision;
    }
    
    // Get cost estimate
    const costEstimate = await costMonitor.estimateCost({
      contextLength,
      outputLength: expectedOutputLength,
    });
    
    // Check if free models are available
    const hasFreeModels = await modelSelector.hasFreeModels();
    
    // Initialize decision factors
    const factors = {
      cost: {
        local: costEstimate.local.cost.total,
        paid: costEstimate.paid.cost.total,
        wasFactor: false,
        weight: 0.3
      },
      complexity: {
        score: complexity,
        wasFactor: false,
        weight: 0.3
      },
      tokenUsage: {
        contextLength,
        outputLength: expectedOutputLength,
        totalTokens: contextLength + expectedOutputLength,
        wasFactor: false,
        weight: 0.2
      },
      priority: {
        value: priority,
        wasFactor: false,
        weight: 0.2
      },
      contextWindow: {
        wasFactor: false,
        weight: 0.4
      },
      benchmarkPerformance: {
        wasFactor: false,
        weight: 0.3
      },
      previousAttempts: {
        failureCount: taskHistory.failureCount,
        wasFactor: taskHistory.failureCount > 0,
        weight: 0.4
      }
    };
    
    // Calculate final routing decision
    const { provider, model, confidence, explanation, localScore, paidScore } = 
      await this.calculateFullRoutingDecision(params, factors, costEstimate, hasFreeModels);
    
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
      verificationRequired: true // Signal that verification should be performed
    };
  },

  /**
   * Force routing to paid API after local failures
   */
  async forcePaidApiRouting(params: TaskRoutingParams): Promise<RoutingDecision> {
    const { complexity } = params;
    const model = complexity >= COMPLEXITY_THRESHOLDS.COMPLEX ? 'gpt-4' : 'gpt-3.5-turbo';
    
    return {
      provider: 'paid',
      model,
      factors: {
        previousAttempts: {
          failureCount: 2,
          wasFactor: true,
          weight: 1.0
        }
      },
      confidence: 0.9,
      explanation: 'Forced to paid API due to previous local model failures',
      scores: {
        local: 0.2,
        paid: 0.8
      },
      verificationRequired: true
    };
  },

  /**
   * Calculate the full routing decision based on all factors
   */
  async calculateFullRoutingDecision(
    params: TaskRoutingParams,
    factors: any,
    costEstimate: any,
    hasFreeModels: boolean
  ): Promise<{
    provider: 'local' | 'paid';
    model: string;
    confidence: number;
    explanation: string;
    localScore: number;
    paidScore: number;
  }> {
    // ... (calculateFullRoutingDecision implementation remains unchanged)
  },

  /**
   * Select the appropriate model based on provider and task characteristics
   */
  async selectModelForProvider(
    provider: 'local' | 'paid',
    complexity: number,
    totalTokens: number
  ): Promise<string> {
    // ... (selectModelForProvider implementation remains unchanged)
  }
};
